import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import QuickSearch from '@/components/blogs/QuickSearch';
import { useTheme } from '@/context/ThemeContext';
export default function Navbar({ blogs }) {
  const { pathname, events } = useRouter();
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    const close = () => setOpen(false);
    events.on('routeChangeStart', close);
    return () => events.off('routeChangeStart', close);
  }, [events]);
  useEffect(() => {
    const escape = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        document.getElementById('menu-toggle')?.focus();
      }
    };
    if (open) document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  return (
    <header className="site-header">
      <nav className="shell nav" aria-label="Main navigation">
        <Link href="/" className="wordmark" title="Vikram Kangotra, home">
          <span className="monogram">
            vk<span>.</span>
          </span>
          <span className="wordmark-name">Vikram Kangotra</span>
        </Link>
        <div className={`nav-links ${open ? 'is-open' : ''}`} id="navigation">
          <Link
            href="/projects"
            aria-current={pathname.startsWith('/projects') ? 'page' : undefined}
          >
            Projects
          </Link>
          <Link href="/blogs" aria-current={pathname.startsWith('/blogs') ? 'page' : undefined}>
            Writing
          </Link>
          <Link
            href="/learn/os"
            aria-current={pathname.startsWith('/learn/os') ? 'page' : undefined}
          >
            OS course
          </Link>
          <Link href="/#about" onClick={() => setOpen(false)}>
            About
          </Link>
          <a href="mailto:vikramkangotra8055@gmail.com" className="nav-contact">
            Contact <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="nav-actions">
          <QuickSearch blogs={blogs} />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              {theme === 'dark' ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                </>
              ) : (
                <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
              )}
            </svg>
          </button>
          <button
            id="menu-toggle"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? 'Close' : 'Menu'} <span aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
