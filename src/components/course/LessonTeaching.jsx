import { useEffect, useId, useState } from 'react';
import { FiEdit3, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import styles from './lesson-teaching.module.css';

function Inline({ text }) {
  return <>{text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)}</>;
}

export function LessonIntroduction({ teaching }) {
  if (!teaching) return null;
  return <div className={styles.introduction} data-lesson-introduction>
    <p className={styles.goalLabel}>In this lesson</p>
    <p className={styles.goal}><Inline text={teaching.goal} /></p>
    <p className={styles.bridge}><Inline text={teaching.bridge} /></p>
  </div>;
}

export function LessonReasoning({ teaching, chapterSlug, sectionId }) {
  const id = useId();
  const storageKey = `vk-os-lesson-notes-v1:${chapterSlug}:${sectionId}`;
  const [note, setNote] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try { setNote((localStorage.getItem(storageKey) || '').slice(0, 6000)); }
    catch { setStorageAvailable(false); }
    setLoaded(true);
  }, [storageKey]);
  if (!teaching?.check) return null;
  function write(value) {
    setNote(value);
    try { localStorage.setItem(storageKey, value); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }
  return <section className={styles.reasoning} aria-labelledby={`${id}-heading`} data-lesson-reasoning>
    <div className={styles.question}>
      <span className={styles.kicker}><FiEdit3 aria-hidden="true" /> THINK IT THROUGH</span>
      <h3 id={`${id}-heading`}>Try explaining it yourself</h3>
      <p id={`${id}-prompt`}><Inline text={teaching.check.prompt} /></p>
      <label htmlFor={`${id}-note`}>Your prediction or explanation</label>
      <textarea id={`${id}-note`} value={note} onChange={event => write(event.target.value)} disabled={!loaded} maxLength={6000} aria-describedby={`${id}-prompt ${id}-note-help`} placeholder="A few sentences, a calculation, or a short instruction trace…" />
      <p id={`${id}-note-help`} className={styles.note}>{storageAvailable ? 'Your notes are saved on this device. This is practice; the coding checkpoint checks your program separately.' : 'Your notes are available for this visit. Browser storage is unavailable, so copy anything you want to keep.'}</p>
      <button type="button" aria-expanded={revealed} aria-controls={`${id}-explanation`} onClick={() => setRevealed(value => !value)}>{revealed ? 'Hide explanation' : 'Show explanation'}{revealed ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}</button>
    </div>
    <div id={`${id}-explanation`} className={styles.explanation} hidden={!revealed}>
      <h4>Let’s work through it</h4>
      {teaching.check.answer.split(/\n\n+/).map((paragraph, index) => <p key={index}><Inline text={paragraph} /></p>)}
      <p className={styles.note}>Compare the steps with your own reasoning. If your prediction changed, add a sentence explaining what you noticed.</p>
    </div>
    <div className={styles.takeaway}><strong>The idea to carry forward</strong><p><Inline text={teaching.takeaway} /></p></div>
  </section>;
}
