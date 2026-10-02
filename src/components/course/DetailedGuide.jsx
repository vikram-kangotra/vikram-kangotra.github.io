import { useId, useState } from 'react';
import { Flowchart } from './LessonDepth';
import flowStyles from './lesson-depth.module.css';
import styles from './detailed-guide.module.css';

function Inline({ text = '' }) {
  return <>{String(text).split(/(`[^`]+`)/g).map((part, i) => part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part)}</>;
}
function Paragraphs({ items = [] }) { return items.map((text, i) => <p key={i}><Inline text={text} /></p>); }

function DataTable({ block }) {
  return <div className={styles.tableScroll} role="region" aria-label={block.caption} tabIndex={0}><table><caption>{block.caption}</caption><thead><tr>{block.columns.map((cell, i) => <th key={i} scope="col"><Inline text={cell} /></th>)}</tr></thead><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => c === 0 ? <th key={c} scope="row"><Inline text={cell} /></th> : <td key={c}><Inline text={cell} /></td>)}</tr>)}</tbody></table></div>;
}

function BitLayout({ block }) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const field = block.fields[selected];
  const rowWidth = Math.min(8, block.width);
  return <figure className={styles.bits} aria-labelledby={`${id}-caption`}>
    <figcaption id={`${id}-caption`}>{block.caption}{block.value && <code>{block.value}</code>}</figcaption>
    <p>Highest bit first. Select a field to inspect its meaning.</p>
    {Array.from({ length: Math.ceil(block.width / rowWidth) }, (_, row) => {
      const high = block.width - row * rowWidth - 1;
      const low = Math.max(0, high - rowWidth + 1);
      return <div key={row} className={styles.bitRow} style={{ gridTemplateColumns: `repeat(${high - low + 1}, minmax(0, 1fr))` }}>{block.fields.map((item, i) => {
        const start = Math.min(high, item.high), end = Math.max(low, item.low);
        if (start < end) return null;
        const position = start === end ? String(start) : `${start}:${end}`;
        const label = start - end < 2 ? (item.name.replace(/\s/g, '').length <= 5 ? item.name.replace(/\s/g, '') : String(i + 1)) : item.name;
        return <button key={i} type="button" aria-pressed={selected === i} aria-controls={`${id}-detail`} aria-label={`${position} ${label}${label === item.name ? '' : `, ${item.name}`}, bits ${item.high} to ${item.low}`} onClick={() => setSelected(i)} style={{ gridColumn: `${high - start + 1} / span ${start - end + 1}` }}><small>{position}</small>{' '}<span>{label}</span></button>;
      })}</div>;
    })}
    <div className={styles.bitDetail} id={`${id}-detail`} aria-live="polite" aria-atomic="true"><strong>{selected + 1}. {field.name} · bits {field.high}:{field.low}</strong><p><Inline text={field.description} /></p></div>
    <details><summary>All fields and bit positions</summary><dl>{block.fields.map((item, i) => <div key={i}><dt>{i + 1}. {item.name} ({item.high}:{item.low})</dt><dd><Inline text={item.description} /></dd></div>)}</dl></details>
  </figure>;
}

function Block({ block }) {
  if (block.type === 'table' || block.type === 'trace') return <DataTable block={block} />;
  if (block.type === 'bits') return <BitLayout block={block} />;
  if (block.type === 'flow') return <div className={flowStyles.depth}><Flowchart chart={block} /></div>;
  if (block.type === 'code') return <section className={styles.code}><h4>{block.title}</h4><pre tabIndex={0} aria-label={`${block.title}, ${block.language}`}><code>{block.code}</code></pre><Paragraphs items={block.notes} /></section>;
  if (block.type === 'steps') return <section><h4>{block.title}</h4><ol className={styles.steps}>{block.items.map((step, i) => <li key={i}><strong>{step.title}</strong><p><Inline text={step.text} /></p></li>)}</ol></section>;
  if (block.type === 'prose') return <section>{block.title && <h4>{block.title}</h4>}<Paragraphs items={block.paragraphs} /></section>;
  return null;
}

export function TopicExercises({ topics = [] }) {
  const exercises = topics.flatMap(topic => topic.blocks.filter(block => block.type === 'exercise').map(block => ({ ...block, topicTitle: topic.title })));
  const [error, setError] = useState('');
  async function openCopy(exercise, solution) {
    try {
      const { savePlaygroundCopy } = await import('@/course/playground');
      const files = solution ? exercise.solutionFiles : exercise.starterFiles;
      window.location.assign(savePlaygroundCopy(files, exercise.mode, { activeFile: exercise.activeFile, title: exercise.title }));
    } catch (failure) { setError(failure.message); }
  }
  if (!exercises.length) return null;
  return <section className={styles.guide} aria-label="Further practice"><h3>Further practice</h3><p>These design and trace exercises deepen this lesson. Compare your reasoning with the worked solution. They do not change checkpoint progress.</p>{error && <p role="alert">{error}</p>}{exercises.map((exercise, i) => <section key={i} className={styles.exercise}><span className={styles.eyebrow}>{exercise.topicTitle}</span><h4>{exercise.title}</h4><p><Inline text={exercise.prompt} /></p><ol>{exercise.tasks.map((task, j) => <li key={j}><Inline text={task} /></li>)}</ol>{exercise.starterFiles && <button type="button" onClick={() => openCopy(exercise, false)}>Open exercise in playground</button>}<details><summary>Show worked solution and checks</summary><Paragraphs items={exercise.solution} /><ul>{exercise.checks.map((check, j) => <li key={j}><Inline text={check} /></li>)}</ul>{exercise.solutionFiles && <button type="button" onClick={() => openCopy(exercise, true)}>Open solution in playground</button>}</details></section>)}</section>;
}

export default function DetailedGuide({ topics = [], onPractice, lessonTopic = false }) {
  if (!topics.length) return null;
  function jump(id) { const heading = document.getElementById(`topic-${id}`); heading?.scrollIntoView({ block: 'start' }); heading?.focus({ preventScroll: true }); }
  return <div className={styles.guide} data-detailed-guide>
    {!lessonTopic && <nav className={styles.contents} aria-label="Detailed topics in this lesson"><strong>Inside the mechanism</strong><ol>{topics.map(topic => <li key={topic.id}><button type="button" onClick={() => jump(topic.id)}>{topic.title}</button></li>)}</ol></nav>}
    {topics.map(topic => <section key={topic.id} className={styles.topic} data-topic={topic.id}>{!lessonTopic && <span className={styles.eyebrow}>MECHANISM · WORKED TRACE · PRACTICE</span>}<h3 id={`topic-${topic.id}`} tabIndex={-1}>{lessonTopic ? 'Worked explanation' : topic.title}</h3>{!lessonTopic && <Paragraphs items={topic.intro} />}{topic.blocks.map((block, i) => <Block key={i} block={block} />)}{topic.blocks.some(block => block.type === 'exercise') && onPractice && <button className={styles.practice} type="button" onClick={onPractice}>Open this lesson’s further practice in Problem</button>}{topic.references?.length > 0 && <aside className={styles.sources}><h4>Read alongside this explanation</h4><ul>{topic.references.map((source, i) => <li key={i}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>{source.section && <span> · {source.section}</span>}</li>)}</ul></aside>}</section>)}
  </div>;
}
