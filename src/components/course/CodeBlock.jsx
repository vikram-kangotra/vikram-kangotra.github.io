import { useEffect, useId, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import styles from './code-block.module.css';

export default function CodeBlock({ code }) {
  const filenameId = useId();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setCopied(false); setFailed(false); }, [code.source]);
  async function copy() {
    try { await navigator.clipboard.writeText(code.source); setCopied(true); setFailed(false); }
    catch { setCopied(false); setFailed(true); }
  }
  return <figure className={styles.codeBlock}>
    <figcaption className={styles.caption}><span className={styles.description}><span id={filenameId} className={styles.filename}>{code.filename || 'Code example'}</span>{code.language && <span className={styles.language}>{code.language}</span>}</span><button type="button" onClick={copy} aria-describedby={filenameId}><span aria-hidden="true">{copied ? <FiCheck /> : <FiCopy />}</span><span aria-live="polite">{copied ? 'Copied' : 'Copy code'}</span></button></figcaption>
    <pre tabIndex={0} aria-label={code.filename || `${code.language || 'Source'} code`}><code>{code.source}</code></pre>
    {failed && <p className={styles.feedback} role="status">Select the code to copy it. Clipboard access is unavailable.</p>}
  </figure>;
}
