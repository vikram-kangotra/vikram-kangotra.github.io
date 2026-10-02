import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FiArrowLeft, FiCode, FiExternalLink } from 'react-icons/fi';
import { SEO } from '@/components/ui';
import CourseShell from '@/components/course/CourseShell';
import BootMachine from '@/components/course/BootMachine';
import { loadPlayground } from '@/course/playground';
import styles from '@/components/course/playground.module.css';

export default function Playground() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!router.isReady) return;
    setWorkspace(null); setError('');
    try { setWorkspace(loadPlayground(router.query.workspace)); }
    catch (caught) { setError(caught.message); }
  }, [router.isReady, router.query.workspace]);

  return <CourseShell immersive context="Open playground">
    <SEO title="x86 Playground: OS from Scratch" description="Write assembly and C, manage your project files, run a real x86 machine, and download your compiled binary. An independent workspace for experimenting." path="/learn/os/playground" />
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}><span className={styles.icon}><FiCode aria-hidden="true" /></span><div><h1>x86 playground</h1><p>{workspace?.id !== 'main' && workspace ? `Independent copy · ${workspace.title}` : 'Your files. Your machine. Room to experiment.'}</p></div></div>
        <div className={styles.links}>{workspace && workspace.id !== 'main' && <Link href="/learn/os/playground">My scratchpad <FiExternalLink aria-hidden="true" /></Link>}<Link href="/learn/os"><FiArrowLeft aria-hidden="true" />Learning path</Link></div>
      </header>
      {error ? <div className={styles.message} role="alert"><h2>Workspace unavailable</h2><p>{error}</p><Link href="/learn/os/playground">Open my scratchpad</Link></div>
        : workspace ? <div className={styles.workspace}><h2 className={styles.srOnly}>Project workspace</h2><BootMachine key={workspace.id} chapterSlug={`playground-${workspace.id}`} playground={workspace} /></div>
          : <div className={`${styles.workspace} ${styles.message}`} role="status">Opening your saved workspace…</div>}
      <footer className={styles.footer}><span>Saved in this browser · Export source to keep a backup.</span><span>Course drafts stay separate. Download binaries from Build after compiling.</span></footer>
    </div>
  </CourseShell>;
}
Playground.coursePage = true;
