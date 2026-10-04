/* global Set */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FiCheck, FiCode, FiLock, FiSearch, FiSkipForward, FiX } from 'react-icons/fi';
import { getCheckpointLessonIndex, isCheckpointSkipped } from '@/course/lessonAccess';
import styles from './chapter-outline.module.css';

function lessonTitle(title) {
  return title.replace(/^\s*\d+(?:\.\d+)*\s*[.)\-–\u2014:]\s*/, '');
}

const searchable = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = { gdt: 'global descriptor table', idt: 'interrupt descriptor table', isr: 'interrupt service routine', mmu: 'memory management unit', pte: 'page table entry' };
const matchesTerm = (text, term) => text.split(' ').some(word => word === term || (term.length > 3 && word.startsWith(term))) || Boolean(aliases[term] && ` ${text} `.includes(` ${aliases[term]} `));

export default function ChapterOutline({ chapter, lessonIndex, readLessons = [], guide, state = {}, gate, onSelectLesson, idPrefix = 'rail' }) {
  const uniqueId = useId();
  const outlineId = `${idPrefix}-${uniqueId}`;
  const [query, setQuery] = useState('');
  const scroller = useRef(null);
  const selected = useRef(null);
  const sections = useMemo(() => chapter.sections || [], [chapter.sections]);
  const lessonsRead = new Set(readLessons);
  const readCount = state.read ? sections.length : sections.filter((_, index) => lessonsRead.has(index)).length;
  const steps = guide?.steps || [];
  const checkpointPassed = (step, index) => (step.tests ? state.behaviorChecks || [] : state.buildSteps || []).includes(index);
  const passedCheckpoints = steps.filter(checkpointPassed).length;
  const skippedCheckpoints = steps.filter((step, index) => !checkpointPassed(step, index) && isCheckpointSkipped(index, state)).length;
  const searchRows = useMemo(() => sections.map(section => searchable([section.title, section.id, ...(section.keywords || []), ...(section.paragraphs || []), section.aid?.title, section.deepDive?.title, ...(section.topics || []).flatMap(topic => [topic.title, topic.id, ...(topic.keywords || []), ...(topic.blocks || []).map(block => block.title || block.caption || '')])].join(' '))), [sections]);
  const terms = searchable(query).split(' ').filter(Boolean);
  const matches = new Set(sections.map((_, index) => index).filter(index => terms.every(term => matchesTerm(searchRows[index], term))));
  const visible = new Set(matches);
  if (terms.length) sections.forEach((section, index) => { if (matches.has(index) && section.parentSectionId) { const parent = sections.findIndex(item => item.id === section.parentSectionId); if (parent >= 0) visible.add(parent); } });

  useEffect(() => { setQuery(''); }, [chapter.slug]);

  useEffect(() => {
    const container = scroller.current;
    if (!container) return undefined;
    function revealSelected() {
      const row = selected.current;
      if (!row || !container.clientHeight) return;
      const viewport = container.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      // scrollIntoView can also move the lesson/page. Move only this rail.
      if (bounds.top < viewport.top + 8) container.scrollTop += bounds.top - viewport.top - 8;
      else if (bounds.bottom > viewport.bottom - 8) container.scrollTop += bounds.bottom - viewport.bottom + 8;
    }
    revealSelected();
    // Also reveal the active row when a hidden rail is shown after coding.
    if (typeof window.ResizeObserver !== 'function') return undefined;
    const observer = new window.ResizeObserver(revealSelected);
    observer.observe(container);
    return () => observer.disconnect();
  }, [chapter.slug, lessonIndex, query]);

  return <nav className={styles.outline} aria-label="Chapter lessons" data-chapter-outline data-outline-view={idPrefix}>
    <header className={styles.header}>
      {idPrefix !== 'overview' && <h2>In this chapter</h2>}
      <p>{readCount} of {sections.length} lessons read</p>
      <progress className={styles.progress} aria-label="Lessons read" max={Math.max(1, sections.length)} value={readCount} />
      <div className={styles.search}>
        <FiSearch aria-hidden="true" />
        <label className={styles.srOnly} htmlFor={`${outlineId}-search`}>Search this chapter</label>
        <input id={`${outlineId}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a lesson or topic" autoComplete="off" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear lesson search"><FiX aria-hidden="true" /></button>}
      </div>
      {terms.length > 0 && <p className={styles.searchStatus} role="status">{matches.size} {matches.size === 1 ? 'lesson' : 'lessons'} found</p>}
    </header>
    <div ref={scroller} className={styles.scroll} data-outline-scroll>
      <ol className={styles.lessons} role="list">
        {sections.map((section, index) => {
          if (!visible.has(index)) return null;
          const title = lessonTitle(section.title);
          const read = Boolean(state.read || lessonsRead.has(index));
          const active = index === lessonIndex;
          const locked = !!gate && index > gate.lessonIndex;
          const lockReason = locked ? `Pass or skip the checkpoint in lesson ${gate.lessonIndex + 1} to unlock this lesson.` : '';
          const checkpoints = steps.map((step, stepIndex) => ({ step, stepIndex })).filter(({ step }) => getCheckpointLessonIndex(chapter, step) === index);
          const passed = checkpoints.length > 0 && checkpoints.every(({ step, stepIndex }) => checkpointPassed(step, stepIndex));
          const skipped = !passed && checkpoints.some(({ stepIndex }) => isCheckpointSkipped(stepIndex, state));
          const checkpointStatus = checkpoints.length ? passed ? 'Coding checkpoint passed' : skipped ? 'Coding checkpoint skipped; submission pending' : 'Coding checkpoint not passed' : '';
          const statusId = `${outlineId}-lesson-${index}-status`;
          return <li key={section.id} data-sublesson={!!section.parentSectionId} data-search-context={terms.length > 0 && !matches.has(index) || undefined}>
            <button ref={active ? selected : undefined} type="button" className={styles.lesson} data-lesson-index={index} data-read={read} data-locked={locked} data-checkpoint-state={checkpoints.length ? passed ? 'passed' : skipped ? 'skipped' : 'pending' : undefined} aria-disabled={locked || undefined} aria-current={active ? 'step' : undefined} title={lockReason || undefined} aria-describedby={statusId} onClick={() => onSelectLesson?.(index)}>
              <span className={styles.number}>{read ? <FiCheck aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
              <span className={styles.title}>{title}{skipped && <small className={styles.skippedLabel}>Skipped</small>}</span>
              {locked ? <span className={styles.codeMarker} aria-hidden="true"><FiLock /></span> : checkpoints.length > 0 && <span className={styles.codeMarker} title={checkpointStatus} aria-hidden="true">{skipped ? <FiSkipForward /> : <FiCode />}</span>}
            </button>
            <span id={statusId} hidden>{read ? 'Read.' : 'Not read.'}{locked ? ` Locked. ${lockReason}` : ''}{checkpointStatus ? ` ${checkpointStatus}.` : ''}</span>
          </li>;
        })}
      </ol>
      {matches.size === 0 && <p className={styles.empty}>No lessons match “{query}”. <Link prefetch={false} href="/learn/os/reference">Browse all topics</Link>.</p>}
    </div>
    {steps.length > 0 && <div className={styles.checkpoints}><FiCode aria-hidden="true" /><span>{passedCheckpoints} of {steps.length} {steps.length === 1 ? 'checkpoint' : 'checkpoints'} passed{skippedCheckpoints > 0 && <small>{skippedCheckpoints} skipped · revisit anytime</small>}</span></div>}
  </nav>;
}
