/* global Map */
import { useId, useRef, useState } from 'react';
import { FiArrowDown, FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import CodeBlock from './CodeBlock';
import styles from './lesson-visual.module.css';

const kindLabels = {
  flow: 'Architecture map',
  memory: 'Memory layout',
  bits: 'Field layout',
  trace: 'Worked trace',
  compare: 'Compare the cases',
};

const instructions = {
  flow: 'Select a component to inspect its role and the data it receives.',
  memory: 'Select an address block to inspect what lives there. Blocks are schematic, not drawn to scale.',
  bits: 'Select a field to see how its bits affect the machine. Field widths are not drawn to scale.',
  trace: 'Step through the example. Each step shows the state at that point.',
  compare: 'Select a case to compare its state, behavior, or constraints.',
};

function LessonModel({ aid }) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const buttons = useRef([]);
  const nodes = aid.nodes || [];
  const kind = kindLabels[aid.kind] ? aid.kind : 'flow';
  const currentIndex = Math.min(selected, nodes.length - 1);
  const current = nodes[currentIndex];
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const connections = (aid.connections || []).filter(connection =>
    nodeIndex.has(connection.from) && nodeIndex.has(connection.to));
  const hasConnections = connections.length > 0;
  const extraConnections = connections.filter(connection =>
    !['flow', 'trace'].includes(kind) || nodes[nodeIndex.get(connection.from) + 1]?.id !== connection.to);

  function moveFocus(event, index) {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % nodes.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + nodes.length) % nodes.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = nodes.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }

  function selectEndpoint(index) {
    setSelected(index);
    buttons.current[index]?.focus();
  }

  if (!current) return null;

  return <figure className={styles.visual} data-kind={kind} aria-labelledby={`${id}-title`}>
    <figcaption className={styles.heading}>
      <div className={styles.kicker}><span>{kindLabels[kind]}</span><span className={styles.modelBadge}>Concept model</span></div>
      <h3 id={`${id}-title`}>{aid.title}</h3>
      {aid.intro && <p>{aid.intro}</p>}
    </figcaption>

    {aid.sample?.source && <div className={styles.sample}><CodeBlock code={aid.sample} /></div>}

    <div className={styles.body}>
      <div className={styles.controls}>
        <div className={styles.diagram}>
          <p className={styles.instruction} id={`${id}-instruction`}>{instructions[kind]}</p>
          <ol className={`${styles.nodes} ${styles[kind]}`} aria-label={`${aid.title}: ${kind === 'trace' ? 'steps' : 'components'}`} aria-describedby={`${id}-instruction`}>
            {nodes.map((node, index) => {
              const next = nodes[index + 1];
              const nextConnection = connections.find(connection => connection.from === node.id && connection.to === next?.id);
              const showConnector = index < nodes.length - 1 && (kind === 'trace' || (kind === 'flow' && (!hasConnections || nextConnection)));
              return <li key={node.id || index} className={styles.nodeItem}>
                <button type="button" ref={element => { buttons.current[index] = element; }}
                  className={styles.node} aria-pressed={index === currentIndex} aria-controls={`${id}-detail`}
                  onClick={() => setSelected(index)} onKeyDown={event => moveFocus(event, index)}>
                  <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.nodeText}>
                    {node.subtitle && <span className={styles.subtitle}>{node.subtitle}</span>}
                    <span className={styles.nodeTitle}>{node.title}</span>
                  </span>
                  <span className={styles.selection} aria-hidden="true">{index === currentIndex ? 'Viewing' : 'Inspect'}</span>
                </button>
                {showConnector && <span className={styles.connector}><FiArrowDown aria-hidden="true" />{nextConnection?.label && <span>{nextConnection.label}</span>}</span>}
              </li>;
            })}
          </ol>

          {extraConnections.length > 0 && <div className={styles.relationships}>
            <p className={styles.relationshipTitle}>Connections <span>Follow a handoff</span></p>
            <ul aria-label="Connections between components">
              {extraConnections.map((connection, index) => {
                const from = nodeIndex.get(connection.from);
                const to = nodeIndex.get(connection.to);
                const active = from === currentIndex || to === currentIndex;
                return <li key={`${connection.from}-${connection.to}-${index}`} data-active={active}>
                  <div className={styles.endpoints}>
                    <button type="button" onClick={() => selectEndpoint(from)} aria-label={`Inspect ${nodes[from].title}`}>{nodes[from].title}</button>
                    <FiArrowRight aria-hidden="true" />
                    <button type="button" onClick={() => selectEndpoint(to)} aria-label={`Inspect ${nodes[to].title}`}>{nodes[to].title}</button>
                  </div>
                  {connection.label && <span className={styles.connectionLabel}>{connection.label}</span>}
                </li>;
              })}
            </ul>
          </div>}
        </div>

        {kind === 'trace' && <div className={styles.traceControls} aria-label="Trace navigation">
          <button type="button" disabled={currentIndex === 0} onClick={() => setSelected(currentIndex - 1)}><FiChevronLeft aria-hidden="true" /> Previous step</button>
          <span>{currentIndex + 1} / {nodes.length}</span>
          <button type="button" disabled={currentIndex === nodes.length - 1} onClick={() => setSelected(currentIndex + 1)}>Next step <FiChevronRight aria-hidden="true" /></button>
        </div>}
      </div>

      <section className={styles.detail} id={`${id}-detail`} aria-labelledby={`${id}-detail-title`}>
        <div className={styles.detailHeading}>
          <span className={styles.detailIndex}>{kind === 'trace' ? 'Step' : 'Part'} {currentIndex + 1} of {nodes.length}</span>
          <h4 id={`${id}-detail-title`}>{current.title}</h4>
        </div>
        <p className={styles.explanation}>{current.explanation}</p>
        {current.facts?.length > 0 && <dl className={styles.facts} aria-label={kind === 'trace' ? 'State at this step' : 'Details'}>
          {current.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>}
        {current.code?.source && <CodeBlock key={current.id || currentIndex} code={current.code} />}
      </section>
    </div>

    <p className={styles.announcement} role="status" aria-live="polite" aria-atomic="true">{kind === 'trace' ? 'Step' : 'Part'} {currentIndex + 1} of {nodes.length}: {current.title}</p>
    <p className={styles.caption}>{aid.caption || 'This diagram explains the mechanism. Use the workspace to run your own code on the x86 emulator.'}</p>
  </figure>;
}

export default function LessonVisual({ aid }) {
  if (!aid?.nodes?.length) return null;
  return <LessonModel key={`${aid.kind}-${aid.title}`} aid={aid} />;
}
