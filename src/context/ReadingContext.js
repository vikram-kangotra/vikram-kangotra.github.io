import { createContext, useContext, useEffect, useState } from 'react';
const ReadingContext = createContext();
const KEY = 'vk-reading-list';
export function ReadingProvider({ children }) {
  const [saved, setSaved] = useState([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    function load() {
      try {
        const value = JSON.parse(localStorage.getItem(KEY) || '[]');
        setSaved(Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);
      } catch {
        setSaved([]);
      }
      setReady(true);
    }
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);
  function toggleSaved(slug) {
    const next = saved.includes(slug) ? saved.filter((s) => s !== slug) : [...saved, slug];
    setSaved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setNotice(
        next.includes(slug) ? 'Added to your reading list.' : 'Removed from your reading list.'
      );
    } catch {
      setNotice('Saved for this visit. Browser storage is unavailable.');
    }
  }
  return (
    <ReadingContext.Provider value={{ saved, ready, toggleSaved }}>
      {children}
      <div className="sr-only" role="status">
        {notice}
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
      aria-label={`${active ? 'Remove' : 'Save'} ${title}${active ? ' from reading list' : ' to reading list'}`}
      title={active ? 'Remove from reading list' : 'Save for later'}
      onClick={() => toggleSaved(slug)}
    >
      <Bookmark filled={active} />
      {withLabel && <span>{active ? 'Saved' : 'Save for later'}</span>}
    </button>
  );
}
