import { useId } from 'react';
import CodeBlock from './CodeBlock';
import styles from './checkpoint-brief.module.css';

function Inline({ text }) { return <>{text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)}</>; }
function State({ rows, label }) {
  if (!rows.length) return null;
  return <div className={styles.state}><h5>{label}</h5><dl>{rows.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div>;
}

export default function CheckpointBrief({ brief, compact = false, upcoming = false, onOpenFile, disabled, interfaceCode }) {
  const id = useId();
  if (!brief) return null;
  return <section className={styles.brief} data-compact={compact} aria-labelledby={`${id}-title`} data-checkpoint-brief>
    <header className={styles.heading}><div className={styles.kicker}><span>{upcoming ? 'UPCOMING PROBLEM' : 'YOUR CHECKPOINT'} · {String(brief.number).padStart(2, '0')}</span><span>{`${brief.caseCount || 1} machine ${brief.caseCount === 1 ? 'case' : 'cases'}`}</span></div><h3 id={`${id}-title`}>{brief.title}</h3><p className={styles.goal}>{brief.goal}</p></header>
    <div className={styles.body}>
      {brief.learningGoal && <div className={styles.connection}><strong>Put the lesson into practice</strong><p><Inline text={brief.learningGoal} /></p><p><Inline text={brief.connection} /></p></div>}
      <h4>1. Where to work</h4><p>{brief.startingPoint}</p><ul className={styles.files}>{brief.files.map(path => <li key={path}>{onOpenFile ? <button type="button" disabled={disabled} onClick={() => onOpenFile(path)} title={`Open or create ${path}`}><code>{path}</code><span>Open file →</span></button> : <code>{path}</code>}</li>)}</ul>
      <h4>2. What to implement</h4><ol className={styles.tasks}>{brief.tasks.map((task, index) => <li key={index}><Inline text={task} /></li>)}</ol>
      <h4>3. Given → expected</h4><p>{brief.supplied}</p>
      {brief.suppliedInterfaces && <State rows={brief.suppliedInterfaces} label="Supplied API: already implemented by the test harness" />}
      {brief.example && <div className={styles.example}><div><strong>Given</strong><p>{brief.example.input}</p></div><div><strong>Expected behavior</strong><p>{brief.example.result}</p></div></div>}
      <State rows={brief.inputRows} label="Sample state before your instructions begin" />
      {brief.output && <div className={styles.output}><h5>Expected VGA output for the sample</h5><pre>{brief.output}</pre></div>}
      <State rows={brief.expectedRows} label="Machine state after your code finishes (sample)" />
      {brief.scaffold && <details className={styles.details}><summary>What the assembly lab already supplies</summary><p>{brief.scaffold}</p></details>}
      {interfaceCode && <details className={styles.details} open={!compact}><summary>Function interface: start here</summary><CodeBlock code={interfaceCode} /></details>}
      {brief.contract && <details className={styles.details}><summary>Exact requirements used by the tests</summary><p>{brief.contract}</p></details>}
      <h4>4. How to finish</h4><ol className={styles.tasks}>{brief.finish.map((item, index) => <li key={index}>{item}</li>)}</ol>
      {brief.scope && <details className={styles.details}><summary>What you have checked, and what comes later</summary><p>{brief.scope}</p></details>}
      <p className={styles.help}>Stuck? Use Check in the workspace for hints or Peek at answer. Comparing an answer never overwrites your files or marks the checkpoint complete.</p>
    </div>
  </section>;
}
