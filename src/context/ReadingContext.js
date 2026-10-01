/* global Map, Set */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
const ReadingContext = createContext();
const KEY = 'vk-reading-list';
function readList(raw) {
  const value = JSON.parse(raw || '[]');
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string'))] : [];
}
function applyPending(saved, pending) {
  const next = new Set(saved);
  pending.forEach((active, slug) => (active ? next.add(slug) : next.delete(slug)));
  return [...next];
}
export function ReadingProvider({ children }) {
  const [saved, setSaved] = useState([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const current = useRef([]);
  const pending = useRef(new Map());
  const noticeSource = useRef(null);
  useEffect(() => {
    function load(event) {
      if (event && event.key !== null && event.key !== KEY) return;
      try {
        if (event?.storageArea && event.storageArea !== localStorage) return;
        const value = readList(localStorage.getItem(KEY));
        current.current = applyPending(value, pending.current);
        setSaved(current.current);
      } catch {
        setStorageAvailable(false);
      }
      setReady(true);
    }
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);
  function toggleSaved(slug) {
    noticeSource.current = document.activeElement;
    let latest = current.current;
    try {
      latest = applyPending(readList(localStorage.getItem(KEY)), pending.current);
    } catch {
      /* Preserve this visit's list if reading storage fails. */
    }
    const active = !latest.includes(slug);
    pending.current.set(slug, active);
    const next = applyPending(latest, pending.current);
    current.current = next;
    setSaved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      pending.current.clear();
      setStorageAvailable(true);
      setNotice(active ? 'Added to your reading list.' : 'Removed from your reading list.');
    } catch {
      setStorageAvailable(false);
      setNotice(
        `${active ? 'Added to' : 'Removed from'} your reading list for this visit. Browser storage is unavailable; this change will not survive closing the page.`
      );
    }
  }
  return (
    <ReadingContext.Provider value={{ saved, ready, toggleSaved, storageAvailable }}>
      {children}
      <div
        className={!storageAvailable && notice ? 'reading-list-notice' : 'sr-only'}
        role="status"
      >
        <span>{notice}</span>
        {!storageAvailable && notice && (
          <button
            type="button"
            onClick={() => {
              setNotice('');
              if (noticeSource.current?.isConnected) noticeSource.current.focus();
              else document.getElementById('main-content')?.focus();
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </ReadingContext.Provider>
  );
}
export const useReading = () => useContext(ReadingContext);
export function Bookmark({ filled = false }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  );
}
export function SaveButton({ slug, title, withLabel = false }) {
  const { saved, ready, toggleSaved } = useReading();
  const active = saved.includes(slug);
  return (
    <button
      type="button"
      className={`save-button ${active ? 'is-saved' : ''}`}
      disabled={!ready}
      aria-pressed={active}
      aria-label={
        withLabel
          ? `${active ? 'Saved' : 'Save for later'}: ${title}`
          : `${active ? 'Remove' : 'Save'} ${title}${active ? ' from reading list' : ' to reading list'}`
      }
      title={active ? 'Remove from reading list' : 'Save for later'}
      onClick={() => toggleSaved(slug)}
    >
      <Bookmark filled={active} />
      {withLabel && <span>{active ? 'Saved' : 'Save for later'}</span>}
    </button>
  );
}
