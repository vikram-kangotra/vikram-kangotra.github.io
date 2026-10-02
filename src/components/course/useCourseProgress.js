import { useEffect, useRef, useState } from 'react';
import { parseCourseProgress, versionCourseProgressPatch } from '@/course/courseProgress';

const KEY = 'vk-os-course-v1';
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
    try { progressRef.current = retainUnsaved(parseCourseProgress(localStorage.getItem(KEY)), unsaved.current); setProgress(progressRef.current); }
    catch { setStorageAvailable(false); }
    setLoaded(true);
    const sync = (event) => {
      if (event.key !== KEY) return;
      progressRef.current = retainUnsaved(parseCourseProgress(event.newValue), unsaved.current);
      setProgress(progressRef.current);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function update(slug, patch) {
    patch = versionCourseProgressPatch(slug, patch);
    let base = progressRef.current;
    try { base = retainUnsaved({ ...base, ...parseCourseProgress(localStorage.getItem(KEY)) }, unsaved.current); }
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
