import { useState } from 'react';
import Link from 'next/link';
import { playgroundProjects, projectGuides } from '@/course/playgroundProjects';
import { savePlaygroundCopy } from '@/course/playground';
import styles from './assembly-workbench.module.css';

export default function ProjectGuide({ mode, onFile }) {
  const guide = projectGuides[mode];
  const [error, setError] = useState('');
  function fresh() {
    try { window.location.assign(savePlaygroundCopy(playgroundProjects[mode], mode === 'example' ? 'assembly' : mode === 'kernel' ? 'kernel' : 'boot-sector', { title: guide.title, activeFile: guide.file })); }
    catch (failure) { setError(failure.message); }
  }
  return <details className={styles.details} style={{ margin: '12px 16px' }}><summary>Project guide and updated starter</summary><h3>{guide.title}</h3><p>Reference output: <code>{guide.output}</code></p><ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><nav aria-label="Project explanations"><ul>{guide.topics.map(([label, id]) => <li key={id}><Link prefetch={false} href={`/learn/os/reference/${id}`}>{label}</Link></li>)}</ul></nav><p>Your saved files stay in this workspace. Open a fresh starter to use the updated project in its own workspace.</p><div className={styles.secondaryActions}><button type="button" onClick={() => onFile('README.md')}>Read project walkthrough</button><button type="button" onClick={fresh}>Open fresh {mode === 'kernel' ? 'C kernel' : mode === 'example' ? 'assembly' : 'boot sector'} starter</button></div>{error && <p role="alert">{error}</p>}</details>;
}
