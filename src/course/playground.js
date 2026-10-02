/* global globalThis */
import { playgroundProjects } from './playgroundProjects';
import { validateProjectFiles } from '@/components/course/useProjectFiles';

const COPY_PREFIX = 'vk-os-playground-copy-v1:';
const projects = playgroundProjects;
const routineFiles = projects.example;

export const defaultPlayground = {
  id: 'main', title: 'Your scratchpad', initialMode: 'example',
  initialFiles: routineFiles, activeFile: 'lesson.asm', projects,
};

function projectMode(files, kind) {
  if (kind === 'assembly' && Object.hasOwn(files, 'lesson.asm')) return 'example';
  if (kind === 'kernel' || kind === 'project') return 'kernel';
  try { if (JSON.parse(files['build.json'] || '{}').type === 'kernel32') return 'kernel'; } catch { /* The editor will show invalid manifest diagnostics at build time. */ }
  return 'challenge';
}

// Each copy gets an independent workspace; neither the lesson nor an existing
// playground is overwritten. Source is validated before it reaches storage.
export function savePlaygroundCopy(files, kind, { activeFile, title, setupFile } = {}) {
  const validated = validateProjectFiles(files);
  if (setupFile && (typeof setupFile !== 'string' || !Object.hasOwn(validated, setupFile))) throw new Error('The playground input file must name one of the copied source files.');
  const id = `${Date.now().toString(36)}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const copy = {
    version: 1, mode: projectMode(validated, kind), files: validated,
    activeFile: Object.hasOwn(validated, activeFile) ? activeFile : Object.keys(validated)[0],
    title: typeof title === 'string' ? title.slice(0, 120) : 'Copied course draft',
    ...(setupFile ? { setupFile } : {}),
  };
  localStorage.setItem(`${COPY_PREFIX}${id}`, JSON.stringify(copy));
  return `/learn/os/playground?workspace=${encodeURIComponent(id)}`;
}

export function loadPlayground(workspace) {
  if (!workspace || workspace === 'main') return defaultPlayground;
  if (typeof workspace !== 'string' || !/^[a-z0-9-]{1,100}$/.test(workspace)) throw new Error('This workspace address is invalid.');
  const raw = localStorage.getItem(`${COPY_PREFIX}${workspace}`);
  if (!raw) throw new Error('This copied workspace is not saved in this browser. Open the lesson and copy its draft again, or import an exported project into your scratchpad.');
  const copy = JSON.parse(raw);
  if (copy.version !== 1 || !['example', 'challenge', 'kernel'].includes(copy.mode)) throw new Error('This workspace could not be restored. Your lesson files are unaffected.');
  const files = validateProjectFiles(copy.files);
  if (copy.setupFile && (typeof copy.setupFile !== 'string' || !Object.hasOwn(files, copy.setupFile))) throw new Error('This workspace input file could not be restored.');
  return {
    id: workspace, title: typeof copy.title === 'string' ? copy.title.slice(0, 120) : 'Copied course draft',
    initialMode: copy.mode, initialFiles: files,
    activeFile: Object.hasOwn(files, copy.activeFile) ? copy.activeFile : Object.keys(files)[0],
    ...(copy.setupFile ? { setupFile: copy.setupFile } : {}),
    projects: { ...projects, [copy.mode]: files },
  };
}
