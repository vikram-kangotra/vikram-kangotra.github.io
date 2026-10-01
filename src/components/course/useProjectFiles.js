import { useCallback, useEffect, useRef, useState } from 'react';
import { kernelProjectFiles } from '@/course/kernelProject';

const KERNEL_KEY = 'vk-os-kernel-project-v1';
const MAX_FILE_LENGTH = 262144;
const MAX_PROJECT_LENGTH = 1048576;
export function validateProjectFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('A project needs a file map.');
  const entries = Object.entries(files);
  if (!entries.length || entries.length > 64) throw new Error('Keep between 1 and 64 files in this project.');
  let size = 0;
  for (const [path, source] of entries) {
    const parts = path.split('/');
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.length > 160 || parts.some((part) => !part || part.startsWith('.course-') || ['.', '..', '__proto__', 'prototype', 'constructor'].includes(part))) throw new Error('Use a relative path with letters, numbers, dots, dashes, and slashes. Names beginning .course- are reserved for the build tools.');
    if (typeof source !== 'string') throw new Error('Project files must contain text.');
    if (source.length > MAX_FILE_LENGTH) throw new Error('Keep each source file to 262,144 characters or fewer.');
    size += source.length;
    if (size > MAX_PROJECT_LENGTH) throw new Error('Keep combined project source to 1,048,576 characters or fewer.');
    if (entries.some(([other]) => other !== path && other.startsWith(`${path}/`))) throw new Error('A path cannot be both a file and a directory.');
  }
  return Object.fromEntries(entries);
}
function safeFiles(value, fallback) { try { return validateProjectFiles(value); } catch { return fallback; } }
const firstFile = (files, preferred) => Object.hasOwn(files, preferred) ? preferred : Object.keys(files)[0];
const fingerprint = (files) => JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
function readSavedKernel(storageKey = KERNEL_KEY, fallback = kernelProjectFiles) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { files: fallback, activeFile: firstFile(fallback, 'kernel/main.c'), signature: fingerprint(fallback) };
  const saved = JSON.parse(raw);
  const files = validateProjectFiles(saved?.files);
  return { files, activeFile: firstFile(files, saved?.activeFile || 'kernel/main.c'), signature: fingerprint(files) };
}

export default function useProjectFiles({ chapterSlug, exampleSource, challengeSource, challengeEnabled, onMutate, guided, playground }) {
  const key = playground ? `vk-os-playground-files-v1:${playground.id}` : `${guided ? 'vk-os-guided-files-v1' : 'vk-os-assembly-v2'}:${chapterSlug}`;
  const kernelStorageKey = playground ? `vk-os-playground-kernel-v1:${playground.id}` : guided ? 'vk-os-guided-kernel-v1' : KERNEL_KEY;
  const initialMode = playground?.initialMode || (guided && guided.kind !== 'assembly' ? 'kernel' : 'example');
  const initialFiles = playground?.initialFiles || guided?.initialFiles;
  const defaults = playground ? playground.projects : { example: guided?.kind === 'assembly' ? initialFiles : { 'boot.asm': exampleSource }, challenge: { 'boot.asm': challengeSource }, kernel: guided && guided.kind !== 'assembly' ? initialFiles : kernelProjectFiles };
  const allowChallenge = Boolean(playground || challengeEnabled);
  const projects = useRef(defaults);
  const modeRef = useRef(initialMode);
  const filesRef = useRef(defaults[initialMode]);
  const activeRef = useRef(firstFile(defaults[initialMode], playground?.activeFile || 'lesson.asm'));
  const activeByMode = useRef({ example: 'boot.asm', challenge: 'boot.asm', kernel: 'kernel/main.c' });
  const kernelSignature = useRef(fingerprint(defaults.kernel));
  const conflictRef = useRef(false);
  const recoveredKernel = useRef(null);
  const changed = useRef(onMutate); changed.current = onMutate;
  const [mode, setMode] = useState(initialMode);
  const [files, setFiles] = useState(defaults[initialMode]);
  const [activeFile, setActive] = useState(firstFile(defaults[initialMode], playground?.activeFile || 'lesson.asm'));
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [storageConflict, setStorageConflict] = useState(false);
  const [recoveredKernelFiles, setRecoveredKernelFiles] = useState(null);
  const [undo, setUndo] = useState(null);

  const markConflict = useCallback((value) => { conflictRef.current = value; setStorageConflict(value); }, []);

  useEffect(() => {
    let saved = null;
    let kernel = { files: defaults.kernel, activeFile: firstFile(defaults.kernel, 'kernel/main.c'), signature: fingerprint(defaults.kernel) };
    let kernelUnreadable = false;
    setStorageAvailable(true);
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { setStorageAvailable(false); }
    try { kernel = readSavedKernel(kernelStorageKey, defaults.kernel); }
    catch { kernelUnreadable = true; setStorageAvailable(false); }
    const next = { ...defaults, kernel: kernel.files };
    for (const name of ['example', 'challenge']) {
      const legacy = saved?.drafts?.[name];
      if (typeof legacy === 'string' && legacy.length <= 131072) next[name] = { 'boot.asm': legacy };
      if (saved?.projects?.[name]) next[name] = safeFiles(saved.projects[name], next[name]);
    }
    let selected = ['example', 'kernel', ...(allowChallenge ? ['challenge'] : [])].includes(saved?.example) ? saved.example : initialMode;
    if (!saved?.example && challengeEnabled && !playground && typeof saved?.source === 'string') selected = 'challenge';
    if (selected !== 'kernel' && !saved?.projects?.[selected] && typeof saved?.source === 'string' && saved.source.length <= 131072) next[selected] = { 'boot.asm': saved.source };
    if (!guided && !playground && !saved && chapterSlug === 'bootloading') {
      try { const legacy = localStorage.getItem('vk-os-boot-source-v1'); if (legacy && legacy !== exampleSource && legacy.length <= 131072) { selected = challengeEnabled ? 'challenge' : 'example'; next[selected] = { 'boot.asm': legacy }; } } catch { setStorageAvailable(false); }
    }
    // A divergent draft is saved under this chapter's key, never over the shared
    // project. Refreshing the page therefore does not silently discard it.
    const preservedDraft = safeFiles(saved?.kernelRecovery?.files, null);
    if (preservedDraft) next.kernel = preservedDraft;
    const previousRecovery = safeFiles(saved?.recoveredKernelFiles, null);
    recoveredKernel.current = previousRecovery; setRecoveredKernelFiles(previousRecovery);
    kernelSignature.current = kernel.signature;
    markConflict(Boolean(preservedDraft) || kernelUnreadable);
    const activeModes = {
      example: firstFile(next.example, saved?.activeFiles?.example || (selected === 'example' ? saved?.activeFile || playground?.activeFile : null) || 'boot.asm'),
      challenge: firstFile(next.challenge, saved?.activeFiles?.challenge || (selected === 'challenge' ? saved?.activeFile || playground?.activeFile : null) || 'boot.asm'),
      kernel: firstFile(next.kernel, preservedDraft ? saved?.kernelRecovery?.activeFile : saved?.activeFiles?.kernel || (playground?.initialMode === 'kernel' ? playground.activeFile : null) || kernel.activeFile),
    };
    activeByMode.current = activeModes;
    projects.current = next; modeRef.current = selected; filesRef.current = next[selected];
    activeRef.current = activeModes[selected];
    setMode(selected); setFiles(next[selected]); setActive(activeModes[selected]); setUndo(null); setLoaded(true);
    // Initial file maps belong to the chapter, not to its current checkpoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterSlug, challengeEnabled, allowChallenge, exampleSource, challengeSource, key, markConflict, initialFiles, initialMode, kernelStorageKey]);

  function persistChapter() {
    try {
      localStorage.setItem(key, JSON.stringify({
        source: filesRef.current['boot.asm'] || '', example: modeRef.current,
        activeFile: activeRef.current, activeFiles: activeByMode.current,
        projects: { example: projects.current.example, challenge: projects.current.challenge },
        kernelRecovery: conflictRef.current ? { files: projects.current.kernel, activeFile: activeByMode.current.kernel } : undefined,
        recoveredKernelFiles: recoveredKernel.current || undefined,
      }));
    } catch { setStorageAvailable(false); }
  }
  function persist() {
    if (modeRef.current === 'kernel' && !conflictRef.current) {
      try {
        const saved = readSavedKernel(kernelStorageKey, defaults.kernel);
        // Check at the write boundary too: a storage event can arrive after an
        // input event. Selecting another file must not overwrite another tab.
        if (saved.signature !== kernelSignature.current) markConflict(true);
        else {
          localStorage.setItem(kernelStorageKey, JSON.stringify({ files: projects.current.kernel, activeFile: activeRef.current }));
          kernelSignature.current = fingerprint(projects.current.kernel);
        }
      } catch { markConflict(true); setStorageAvailable(false); }
    }
    persistChapter();
  }

  useEffect(() => {
    function storageChanged(event) {
      if (event.key !== kernelStorageKey && event.key !== null) return;
      if (modeRef.current !== 'kernel') return;
      try {
        if (readSavedKernel(kernelStorageKey, defaults.kernel).signature === kernelSignature.current) return;
      } catch { setStorageAvailable(false); }
      markConflict(true);
      persistChapter();
    }
    window.addEventListener('storage', storageChanged);
    return () => window.removeEventListener('storage', storageChanged);
    // persistChapter intentionally reads live refs; key scopes the recovery copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kernelStorageKey]);

  function commit(next, active = activeRef.current, { preserveUndo = false } = {}) {
    next = validateProjectFiles(next);
    const selected = firstFile(next, active);
    if (!preserveUndo) setUndo(null);
    projects.current[modeRef.current] = next; filesRef.current = next; activeRef.current = selected;
    activeByMode.current[modeRef.current] = selected;
    setFiles(next); setActive(selected); persist(); changed.current?.(next, modeRef.current);
  }
  function reloadKernel() {
    try {
      const latest = readSavedKernel(kernelStorageKey, defaults.kernel);
      if (conflictRef.current && fingerprint(projects.current.kernel) !== latest.signature) {
        recoveredKernel.current = projects.current.kernel;
        setRecoveredKernelFiles(recoveredKernel.current);
      }
      projects.current.kernel = latest.files;
      kernelSignature.current = latest.signature;
      activeByMode.current.kernel = firstFile(latest.files, activeByMode.current.kernel || latest.activeFile);
      markConflict(false); setUndo(null); setStorageAvailable(true);
      if (modeRef.current === 'kernel') commit(latest.files, activeByMode.current.kernel);
      else persistChapter();
      return true;
    } catch { setStorageAvailable(false); return false; }
  }
  function selectMode(next) {
    if (!['example', 'kernel', ...(allowChallenge ? ['challenge'] : [])].includes(next)) return;
    if (next === modeRef.current) { if (next === 'kernel' && conflictRef.current) reloadKernel(); return; }
    if (next === 'kernel' && !conflictRef.current) {
      try {
        const latest = readSavedKernel(kernelStorageKey, defaults.kernel);
        projects.current.kernel = latest.files;
        kernelSignature.current = latest.signature;
        activeByMode.current.kernel = firstFile(latest.files, activeByMode.current.kernel || latest.activeFile);
      } catch { markConflict(true); setStorageAvailable(false); }
    }
    modeRef.current = next; setMode(next);
    commit(projects.current[next], activeByMode.current[next]);
  }
  function selectFile(path) {
    if (!Object.hasOwn(filesRef.current, path)) return;
    activeRef.current = path; activeByMode.current[modeRef.current] = path; setActive(path); persist();
  }
  function editFile(path, text) { if (!Object.hasOwn(filesRef.current, path)) throw new Error('This file no longer exists.'); commit({ ...filesRef.current, [path]: text }); }
  function createFile(path) { if (Object.hasOwn(filesRef.current, path)) throw new Error('A file already exists at that path.'); commit({ ...filesRef.current, [path]: '' }, path); }
  function renameFile(from, to) {
    if (from === to) return;
    if (!Object.hasOwn(filesRef.current, from)) throw new Error('This file no longer exists.');
    if (Object.hasOwn(filesRef.current, to)) throw new Error('A file already exists at that path.');
    const next = { ...filesRef.current, [to]: filesRef.current[from] }; delete next[from]; commit(next, to);
  }
  function remember() { setUndo({ files: filesRef.current, active: activeRef.current }); }
  function deleteFile(path) {
    if (!Object.hasOwn(filesRef.current, path)) throw new Error('This file no longer exists.');
    const next = { ...filesRef.current }; delete next[path]; validateProjectFiles(next); remember(); commit(next, activeRef.current, { preserveUndo: true });
  }
  function reset() { remember(); commit(defaults[modeRef.current], activeByMode.current[modeRef.current], { preserveUndo: true }); }
  function undoChange() { if (!undo) return; commit(undo.files, undo.active); }
  function importFiles(value) { const next = validateProjectFiles(value); remember(); commit(next, activeRef.current, { preserveUndo: true }); }
  return { mode, modeRef, files, filesRef, activeFile, loaded, storageAvailable, storageConflict, recoveredKernelFiles, reloadKernel, undoAvailable: !!undo, selectMode, selectFile, editFile, createFile, renameFile, deleteFile, reset, undoChange, importFiles };
}
