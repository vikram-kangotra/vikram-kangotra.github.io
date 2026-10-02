import { useId, useState } from 'react';
import styles from './lesson-depth.module.css';

function Inline({ text }) {
  return <>{text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)}</>;
}

// The vertical order is deliberately stable: branches bypass steps along the
// right edge; loopbacks return along the left. HTML labels keep their font size
// when the reader narrows the pane, while SVG draws the connecting paths.
export function Flowchart({ chart }) {
  const id = useId();
  const [selected, setSelected] = useState(chart.nodes[0].id);
  const current = chart.nodes.find(node => node.id === selected) || chart.nodes[0];
  const height = chart.nodes.length * 128 - 32;
  let forwardLane = 0;
  let backwardLane = 0;
  const connections = chart.edges.map(edge => {
    const from = chart.nodes.findIndex(node => node.id === edge.from);
    const to = chart.nodes.findIndex(node => node.id === edge.to);
    const straight = to === from + 1;
    const down = to > from;
    const lane = down ? 86 + (forwardLane++ % 2) * 7 : 14 - (backwardLane++ % 2) * 7;
    const start = from * 128 + 48;
    const end = to * 128 + 48;
    const side = down ? 76 : 24;
    return {
      ...edge, from, to, straight,
      path: straight ? `M 50 ${start + 40} V ${end - 44}` : `M ${side} ${start} H ${lane} V ${end} H ${side}`,
      left: straight ? 57 : lane,
      top: straight ? start + 64 : (start + end) / 2,
      active: edge.from === current.id,
    };
  });
  return <figure className={styles.flowchart} aria-labelledby={`${id}-title`}>
    <header><span className={styles.kicker}>FOLLOW THE DECISIONS</span><h4 id={`${id}-title`}>{chart.title}</h4><p><Inline text={chart.intro} /></p></header>
    <p className={styles.graphHint}>Select a step to inspect it. Diamonds are decisions; arrows show the next step.</p>
    <div className={styles.graph} style={{ height }}>
      <svg className={styles.paths} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {connections.map((edge, index) => <path key={index} d={edge.path} vectorEffect="non-scaling-stroke" data-active={edge.active} />)}
      </svg>
      {connections.map((edge, index) => <span key={index} className={styles.edge} aria-hidden="true" data-active={edge.active} style={{ left: `${edge.left}%`, top: edge.top }}>{edge.label}</span>)}
      {connections.map((edge, index) => <span key={index} className={styles.arrow} aria-hidden="true" data-active={edge.active} data-direction={edge.straight ? 'down' : edge.to > edge.from ? 'left' : 'right'} style={{ left: `${edge.straight ? 50 : edge.to > edge.from ? 76 : 24}%`, top: edge.to * 128 + (edge.straight ? 4 : 48) }} />)}
      {chart.nodes.map((node, index) => <button key={node.id} type="button" className={styles.node} data-kind={node.kind || 'process'} aria-pressed={current.id === node.id} aria-controls={`${id}-detail`} onClick={() => setSelected(node.id)} style={{ top: index * 128 + 8 }}>
        <svg viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">{node.kind === 'decision' ? <polygon points="150,1 299,40 150,79 1,40" vectorEffect="non-scaling-stroke" /> : <rect x="1" y="1" width="298" height="78" rx={node.kind === 'terminal' ? 39 : 8} vectorEffect="non-scaling-stroke" />}</svg>
        <span>{node.label}</span>
      </button>)}
    </div>
    <div id={`${id}-detail`} className={styles.nodeDetail} aria-live="polite" aria-atomic="true"><strong>{current.label}</strong><p><Inline text={current.detail} /></p></div>
    <details className={styles.pathsText}><summary>Read the complete flow as text</summary><ol>{chart.nodes.map(node => <li key={node.id}><strong>{node.label}.</strong> <Inline text={node.detail} /><ul>{chart.edges.filter(edge => edge.from === node.id).map((edge, index) => <li key={index}>{edge.label ? `${edge.label}: ` : 'Next: '}{chart.nodes.find(item => item.id === edge.to).label}.</li>)}</ul></li>)}</ol></details>
    <figcaption><Inline text={chart.caption} /></figcaption>
  </figure>;
}

export default function LessonDepth({ depth }) {
  const id = useId();
  if (!depth) return null;
  return <section className={styles.depth} aria-labelledby={`${id}-title`} data-lesson-depth>
    <span className={styles.kicker}>BUILD YOUR UNDERSTANDING</span>
    <h3 id={`${id}-title`}>{depth.title}</h3>
    {depth.paragraphs.map((text, index) => <p key={index}><Inline text={text} /></p>)}
    <section className={styles.example} aria-labelledby={`${id}-example`}>
      <span className={styles.kicker}>WORKED EXAMPLE</span>
      <h4 id={`${id}-example`}>{depth.example.title}</h4>
      <p><Inline text={depth.example.intro} /></p>
      <ol className={styles.steps}>{depth.example.steps.map((step, index) => <li key={index}><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><div><strong>{step.title}</strong><p><Inline text={step.explanation} /></p>{step.state && <pre className={styles.state}><code>{step.state}</code></pre>}</div></li>)}</ol>
      <p className={styles.conclusion}><strong>What this shows. </strong><Inline text={depth.example.conclusion} /></p>
    </section>
    {depth.flowchart && <Flowchart key={depth.flowchart.title} chart={depth.flowchart} />}
    <section className={styles.pitfalls} aria-labelledby={`${id}-pitfalls`}><h4 id={`${id}-pitfalls`}>Where this can go wrong</h4>{depth.pitfalls.map((pitfall, index) => <p key={index}><strong>{pitfall.title}. </strong><Inline text={pitfall.text} /></p>)}</section>
    <aside className={styles.transfer}><h4>Apply it to another case</h4><p><Inline text={depth.transfer} /></p></aside>
  </section>;
}
