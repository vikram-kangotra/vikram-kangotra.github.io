import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { topicsFor } from '@/constants/topics';
export default function QuickSearch({ blogs = [] }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const input = useRef(null);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const results = blogs
    .filter((blog) =>
      `${blog.title} ${blog.excerpt || ''} ${topicsFor(blog.slug).join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    )
    .slice(0, 6);
  function close() {
    dialog.current?.close();
  }
  function open() {
    setQuery('');
    dialog.current.showModal();
    input.current?.focus();
  }
  useEffect(() => {
    function key(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.current.open) dialog.current.close();
        else {
          setQuery('');
          dialog.current.showModal();
          input.current?.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    const change = () => dialog.current?.close();
    router.events.on('routeChangeStart', change);
    return () => {
      document.removeEventListener('keydown', key);
      router.events.off('routeChangeStart', change);
    };
  }, [router.events]);
  function navigate(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const items = [input.current, ...dialog.current.querySelectorAll('.quick-result')];
      items[(items.indexOf(document.activeElement) + 1) % items.length]?.focus();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [input.current, ...dialog.current.querySelectorAll('.quick-result')];
      items[(items.indexOf(document.activeElement) - 1 + items.length) % items.length]?.focus();
    }
    if (event.key === 'Enter' && document.activeElement === input.current) {
      event.preventDefault();
      if (results.length) router.push(`/blogs/${results[0].slug}`);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="quick-search-trigger"
        onClick={open}
        aria-label="Search the site"
        aria-haspopup="dialog"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="6" />
          <path d="m15 15 5 5" />
        </svg>
        <span>Search</span>
        <kbd>⌘ K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="quick-search-dialog"
        aria-labelledby="quick-search-title"
        onKeyDown={navigate}
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const b = dialog.current.getBoundingClientRect();
            if (
              e.clientX < b.left ||
              e.clientX > b.right ||
              e.clientY < b.top ||
              e.clientY > b.bottom
            )
              close();
          }
        }}
      >
        <div className="quick-search-top">
          <h2 id="quick-search-title">Find your next read</h2>
          <button className="dialog-close" onClick={close} aria-label="Close search">
            Esc
          </button>
        </div>
        <label htmlFor="quick-search-input" className="sr-only">
          Search all posts
        </label>
        <input
          ref={input}
          id="quick-search-input"
          type="search"
          placeholder="Search stories and topics…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="quick-results">
          <p className="eyebrow">{query ? 'SEARCH RESULTS' : 'FROM THE NOTEBOOK'}</p>
          {results.map((blog) => (
            <Link
              className="quick-result"
              key={blog.slug}
              href={`/blogs/${blog.slug}`}
              onClick={close}
            >
              <span>{blog.title}</span>
              <small>{topicsFor(blog.slug).join(' / ')}</small>
            </Link>
          ))}
          {results.length === 0 && (
            <p className="quick-empty">
              {blogs.length
                ? 'No matches. Try “Rust” or “GSoC”.'
                : 'Explore the writing archive to find a story.'}
            </p>
          )}
          <Link href="/blogs" className="quick-result quick-all" onClick={close}>
            Browse all writing <span>→</span>
          </Link>
        </div>
        <div className="quick-hint">
          <span>↑ ↓ to navigate · Enter to open</span>
          <span>Esc to close</span>
        </div>
      </dialog>
    </>
  );
}
