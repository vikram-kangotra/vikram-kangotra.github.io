import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowUpRight, FiCode, FiMoon, FiSun, FiTerminal } from 'react-icons/fi';
import styles from './course-shell.module.css';

const CourseTheme = createContext({ theme: 'dark', toggleTheme: () => {} });
export const useCourseTheme = () => useContext(CourseTheme);

export default function CourseShell({ children, immersive = false, toolbar, context }) {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    try { const saved = localStorage.getItem('vk-os-course-theme'); if (saved === 'light' || saved === 'dark') setTheme(saved); } catch { /* Default remains usable. */ }
  }, []);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('vk-os-course-theme', next); } catch { /* Theme works without persistence. */ }
  }
  return <CourseTheme.Provider value={{ theme, toggleTheme }}>
    <div className={`${styles.shell} ${immersive ? styles.immersive : ''}`} data-course-theme={theme}>
      <a className={styles.skip} href="#course-content">Skip to learning content</a>
      <header className={styles.header}>
        <Link prefetch={false} href="/learn/os" className={styles.brand} title="Course home"><span className={styles.brandIcon}><FiTerminal aria-hidden="true" /></span><span>OS <span className={styles.brandLight}>/ from scratch</span></span></Link>
        <div className={styles.context}>{context || 'THE SYSTEMS WORKSHOP'}</div>
        <div className={styles.actions}>{toolbar}<Link prefetch={false} href="/learn/os/playground" className={styles.playgroundLink} title="Open your independent x86 playground"><FiCode aria-hidden="true" /><span>Playground</span></Link><button onClick={toggleTheme} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} course theme`} title={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}</button><Link prefetch={false} className={styles.homeLink} href="/">Vikram’s site <FiArrowUpRight aria-hidden="true" /></Link></div>
      </header>
      <main id="course-content" className={styles.main} tabIndex={-1}>{children}</main>
    </div>
  </CourseTheme.Provider>;
}
