import { useEffect, useRef, useState } from 'react';

const KEY = 'vk-os-course-v1';
function parse(raw) {
  let value;
  try { value = JSON.parse(raw || '{}'); } catch { return {}; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const clean = {};
  Object.entries(value).forEach(([slug, record]) => {
    if (!/^[a-z0-9-]+$/.test(slug) || slug === 'constructor' || slug === 'prototype' || !record || typeof record !== 'object') return;
    const state = {};
    ['complete', 'read', 'lab', 'assembly'].forEach((key) => { state[key] = record[key] === true; });
    ['code', 'reflection'].forEach((key) => { if (typeof record[key] === 'string') state[key] = record[key].slice(0, 200000); });
    if (Array.isArray(record.lessonIds)) state.lessonIds = record.lessonIds.filter(id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)).slice(0, 1000);
    ['checks', 'rubric', 'lessons', 'openBuilds', 'buildAttempts', 'buildSteps', 'buildRuns', 'behaviorChecks', 'skippedCheckpoints'].forEach((key) => { state[key] = Array.isArray(record[key]) ? record[key].filter((i) => Number.isInteger(i) && i >= 0 && i < 100) : []; });
    // Older output-only completions remain readable, but must not appear as
    // completed behavioral verification in the curriculum or course overview.
    const required = slug.startsWith('assembly-') ? [0, 1, 2] : slug === 'bootloading' ? [6, 7, 8] : [0];
    if (!required.every(index => state.behaviorChecks.includes(index))) state.complete = false;
    if (['bootloading', 'capstone'].includes(slug) && !state.assembly) state.complete = false;
    clean[slug] = state;
  });
  return clean;
}
function retainUnsaved(saved, pending) {
  const next = { ...saved };
  for (const [slug, patch] of Object.entries(pending)) next[slug] = { ...next[slug], ...patch };
  return next;
}
export default function useCourseProgress() {
  const [progress, setProgress] = useState({});
  const progressRef = useRef({});
  const unsaved = useRef({});
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try { progressRef.current = retainUnsaved(parse(localStorage.getItem(KEY)), unsaved.current); setProgress(progressRef.current); }
    catch { setStorageAvailable(false); }
    setLoaded(true);
    const sync = (event) => {
      if (event.key !== KEY) return;
      progressRef.current = retainUnsaved(parse(event.newValue), unsaved.current);
      setProgress(progressRef.current);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function update(slug, patch) {
    let base = progressRef.current;
    try { base = retainUnsaved({ ...base, ...parse(localStorage.getItem(KEY)) }, unsaved.current); }
    catch { setStorageAvailable(false); }
    const next = { ...base, [slug]: { ...base[slug], ...patch } };
    // React may batch onPassed and onBoot before another render. Publish the
    // latest state synchronously, and keep failed writes newer than storage.
    progressRef.current = next;
    unsaved.current = { ...unsaved.current, [slug]: { ...unsaved.current[slug], ...patch } };
    setProgress(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); unsaved.current = {}; setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }
  return { progress, update, loaded, storageAvailable };
}
