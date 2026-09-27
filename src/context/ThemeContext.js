import { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext = createContext();
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved;
      try {
        saved = localStorage.getItem('theme');
      } catch {
        /* Storage may be unavailable in private browsing. */
      }
      const value =
        saved === 'dark' || saved === 'light' ? saved : media.matches ? 'dark' : 'light';
      setTheme(value);
      document.documentElement.classList.toggle('dark', value === 'dark');
    };
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  };
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
