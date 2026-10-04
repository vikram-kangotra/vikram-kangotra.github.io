/* global Set */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowRight, FiBookOpen, FiCheck, FiCode, FiSearch, FiTerminal, FiX } from 'react-icons/fi';
import { SEO } from '@/components/ui';
import { chapters, chapterSummary, courseTitle } from '@/course';
import { chapterDirectory } from '@/course/chapterDirectory';
import { searchTopics } from '@/course/topicCatalog';
import { isChapterComplete, resolveLessonProgress } from '@/course/lessonProgress';
import { guidedAssemblyBySlug } from '@/course/guidedAssembly';
import { guidedKernel } from '@/course/guidedKernel';
import { makeProjectGuide } from '@/course/guidedBuild';
import CourseShell from '@/components/course/CourseShell';
import useCourseProgress from '@/components/course/useCourseProgress';
import useTopicCatalog from '@/components/course/useTopicCatalog';
import styles from '@/components/course/course-overview.module.css';

const subjects = {
  'x86 Assembly': { label: 'Assembly', description: 'Registers, instructions, stacks, and routines.' },
  Foundations: { label: 'Boot & CPU', description: 'Bootloaders, GDT, IDT, and interrupts.' },
  Memory: { label: 'Memory', description: 'Paging, physical frames, and allocators.' },
  Processes: { label: 'Processes', description: 'Scheduling, system calls, and concurrency.' },
  Storage: { label: 'Storage & I/O', description: 'Devices, disks, and file systems.' },
  Userland: { label: 'Userland', description: 'The C library and command shell.' },
  Beyond: { label: 'Advanced topics', description: 'x86-64, multicore startup, and kernel integration.' },
};
const subjectKey = phase => phase.toLowerCase().replace(/\s+/g, '-');
const shortcuts = [
  ['GDT', 'gdt-descriptor-bits-and-bytes'], ['IDT', 'idt-populated-table-and-gate'],
  ['Page tables', 'vm-walk-10-10-12'], ['Memory allocators', 'pmm-buddy-split-coalesce'],
];
function hasStarted(state) {
  return Boolean(state && (state.read || state.lessonIds?.length || state.lessons?.length || state.lab || state.assembly || state.code || state.reflection));
}
function readingCount(chapter, state) {
  return resolveLessonProgress({ sections: chapter.sectionIds.map(id => ({ id })), legacySectionIds: chapter.legacySectionIds }, state).lessons.length;
}

export default function Course({ roadmap, lessonCount, courseTitle }) {
  const router = useRouter();
  const { progress, loaded, storageAvailable } = useCourseProgress();
  const [query, setQuery] = useState('');
  const [searchOpened, setSearchOpened] = useState(false);
  const [resultLimit, setResultLimit] = useState(8);
  const [lastChapter, setLastChapter] = useState(null);
  const searchInput = useRef(null);
  const libraryTop = useRef(null);
  const changingSubject = useRef(false);
  const { catalog, loading: searchLoading, error: searchError } = useTopicCatalog(searchOpened || Boolean(query.trim()));
  const results = useMemo(() => query.trim() ? searchTopics(catalog, query) : [], [catalog, query]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vk-os-last-chapter');
      if (roadmap.some(chapter => chapter.slug === saved)) setLastChapter(saved);
    } catch { /* The first chapter remains available without browser storage. */ }
  }, [roadmap]);
  const done = roadmap.filter(chapter => isChapterComplete(chapter, progress[chapter.slug])).length;
  const next = roadmap.find(chapter => chapter.slug === lastChapter && !isChapterComplete(chapter, progress[chapter.slug]))
    || roadmap.find(chapter => hasStarted(progress[chapter.slug]) && !isChapterComplete(chapter, progress[chapter.slug]))
    || roadmap.find(chapter => !isChapterComplete(chapter, progress[chapter.slug])) || roadmap[0];
  const started = loaded && (Boolean(lastChapter) || roadmap.some(chapter => hasStarted(progress[chapter.slug])));
  const phases = [...new Set(roadmap.map(chapter => chapter.phase))];
  const activePhase = phases.find(phase => subjectKey(phase) === router.query.subject) || 'all';
  const selectedChapters = activePhase === 'all' ? roadmap : roadmap.filter(chapter => chapter.phase === activePhase);
  const searching = Boolean(query.trim());
  useEffect(() => {
    if (!changingSubject.current) return;
    changingSubject.current = false;
    if (libraryTop.current?.getBoundingClientRect().top < 0) libraryTop.current.scrollIntoView({ block: 'start' });
  }, [activePhase]);
  function updateQuery(value) { setQuery(value); setResultLimit(8); }
  function clearSearch() { updateQuery(''); searchInput.current?.focus(); }
  function prepareSubjectChange() {
    updateQuery('');
    changingSubject.current = true;
  }
  function selectSubject(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    prepareSubjectChange();
  }
  function selectMobileSubject(event) {
    prepareSubjectChange();
    const phase = event.target.value;
    router.push(phase === 'all' ? '/learn/os' : { pathname: '/learn/os', query: { subject: subjectKey(phase) } }, undefined, { shallow: true, scroll: false });
  }

  return <CourseShell context="Course library">
    <SEO title={`${courseTitle}: Vikram Kangotra`} description="Choose an operating systems chapter. Learn x86 assembly, GDT and IDT, paging, memory allocation, processes, and file systems with coding workspaces." path="/learn/os" />
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.introduction}>
          <p className={styles.kicker}>A hands-on course in C & x86 assembly</p>
          <h1>Build an operating system.</h1>
          <p className={styles.intro}>From your first instruction to a working kernel. Explanations, diagrams, and code you can run.</p>
          <p className={styles.courseMeta}><span>{roadmap.length} chapters</span><span>{lessonCount} lessons</span><span>Run code in your browser</span></p>
        </div>
        <aside className={styles.resume} aria-label={started ? 'Continue learning' : 'Suggested starting point'}>
          <span className={styles.resumeLabel}>{done === roadmap.length ? 'Your course' : started ? 'Continue learning' : 'New to assembly?'}</span>
          <h2>{done === roadmap.length ? 'All chapters complete' : started ? next.cardTitle : 'Your first instruction'}</h2>
          <p>{started ? `${readingCount(next, progress[next.slug])} of ${next.lessons} lessons read in this chapter.` : 'Meet the CPU and run your first program.'}</p>
          <Link prefetch={false} href={`/learn/os/${next.slug}`} className={styles.resumeLink}>{done === roadmap.length ? 'Revisit a chapter' : started ? 'Continue chapter' : 'Start chapter 01'}<FiArrowRight aria-hidden="true" /></Link>
          {loaded && started && <span className={styles.resumeFootnote}>{done} of {roadmap.length} chapters complete</span>}
        </aside>
      </header>
      {!storageAvailable && <p className={styles.storageNotice} role="status">Progress is saved for this visit only. Export your code before leaving to keep your work.</p>}

      <section id="contents" className={styles.contents} aria-labelledby="contents-title">
        <div className={styles.contentsHeader}><div><h2 id="contents-title">Choose a chapter</h2><p>Start anywhere. Every chapter is open.</p></div><Link prefetch={false} href="/learn/os/reference">Topic reference <FiArrowRight aria-hidden="true" /></Link></div>
        <div className={styles.directory}>
          <aside className={styles.subjectRail}>
            <nav aria-label="Filter chapters by subject">
              <p className={styles.railLabel}>Subjects</p>
              <Link prefetch={false} shallow scroll={false} href="/learn/os" aria-current={activePhase === 'all' ? 'true' : undefined} onClick={selectSubject}><span>All chapters</span><span className={styles.subjectCount}>{roadmap.length}</span></Link>
              {phases.map(phase => <Link key={phase} prefetch={false} shallow scroll={false} href={{ pathname: '/learn/os', query: { subject: subjectKey(phase) } }} aria-current={activePhase === phase ? 'true' : undefined} onClick={selectSubject} title={subjects[phase].description}><span>{subjects[phase].label}</span><span className={styles.subjectCount}>{roadmap.filter(chapter => chapter.phase === phase).length}</span></Link>)}
            </nav>
            <div className={styles.mobileSubject}><label htmlFor="course-subject">Subject</label><select id="course-subject" aria-label="Filter chapters by subject" value={activePhase} onChange={selectMobileSubject}><option value="all">All {roadmap.length} chapters</option>{phases.map(phase => <option key={phase} value={phase}>{subjects[phase].label} ({roadmap.filter(chapter => chapter.phase === phase).length})</option>)}</select></div>
            <div className={styles.railHelp}><FiTerminal aria-hidden="true" /><p>Have an idea to try?</p><Link prefetch={false} href="/learn/os/playground">Open the playground <FiArrowRight aria-hidden="true" /></Link></div>
          </aside>
          <div ref={libraryTop} className={styles.library}>
            <label className={styles.srOnly} htmlFor="course-topic-search">Search course topics</label>
            <div className={styles.searchField}>
              <FiSearch aria-hidden="true" />
              <input ref={searchInput} id="course-topic-search" type="search" placeholder="Find a topic: GDT, paging, registers…" value={query} onFocus={() => setSearchOpened(true)} onChange={event => updateQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') updateQuery(''); }} aria-describedby="topic-search-status" autoComplete="off" />
              {query && <button type="button" onClick={clearSearch} aria-label="Clear topic search"><FiX aria-hidden="true" /></button>}
            </div>
            <p id="topic-search-status" className={searching ? styles.searchStatus : styles.srOnly} role="status" aria-live="polite">{searching ? searchLoading ? 'Searching all course topics…' : searchError ? 'Topic search could not load.' : `${results.length} ${results.length === 1 ? 'result' : 'results'} across the course for “${query.trim()}”` : 'Search all lesson titles and detailed topics, across every subject.'}</p>
            {!searching && <div className={styles.shortcuts}><span>Jump to</span>{shortcuts.map(([label, id]) => <Link prefetch={false} key={id} href={`/learn/os/reference/${id}`}>{label}</Link>)}</div>}
            {searching ? <section className={styles.searchResults} aria-label="Topic search results">
              <div className={styles.resultsHeading}><h3>Matching lessons & topics</h3><button type="button" onClick={clearSearch}>Back to chapters</button></div>
              {searchError ? <p className={styles.emptySearch}>You can still <Link prefetch={false} href="/learn/os/reference">browse the complete topic reference</Link>.</p> : !searchLoading && !results.length ? <p className={styles.emptySearch}>No matching topics. Try “GDT”, “page tables”, “stack”, or “slab”.</p> : <>
                <ol>{results.slice(0, resultLimit).map(item => <li key={`${item.kind}-${item.id}`}>
                  <p className={styles.breadcrumb}>{item.phase}<span aria-hidden="true"> / </span>{item.chapterTitle}</p>
                  <Link prefetch={false} href={item.href} className={styles.resultTitle}>{item.title}<FiArrowRight aria-hidden="true" /></Link>
                  {item.summary && <p className={styles.resultSummary}>{item.summary}</p>}
                </li>)}</ol>
                {results.length > resultLimit && <button type="button" className={styles.moreResults} onClick={() => setResultLimit(limit => limit + 8)}>Show {Math.min(8, results.length - resultLimit)} more results</button>}
              </>}
            </section> : <>
              <div className={styles.libraryHeading}><h3>{activePhase === 'all' ? 'All chapters' : subjects[activePhase].label}</h3><p role="status">{selectedChapters.length} {selectedChapters.length === 1 ? 'chapter' : 'chapters'}{activePhase !== 'all' && <span> · {subjects[activePhase].description}</span>}</p></div>
              <ol className={styles.chapterGrid} aria-label="Chapters">
                {selectedChapters.map(chapter => {
                  const state = progress[chapter.slug];
                  const complete = loaded && isChapterComplete(chapter, state);
                  const inProgress = loaded && (hasStarted(state) || lastChapter === chapter.slug) && !complete;
                  const read = loaded ? readingCount(chapter, state) : 0;
                  return <li key={chapter.slug} data-chapter-card={chapter.slug}>
                    <Link prefetch={false} className={styles.chapterCard} href={`/learn/os/${chapter.slug}`} data-state={complete ? 'complete' : inProgress ? 'in-progress' : 'new'}>
                      <div className={styles.cardTop}><span className={styles.chapterNumber}>CH {chapter.id}</span><span>{subjects[chapter.phase].label}</span>{complete && <FiCheck aria-hidden="true" />}</div>
                      <h4 id={`chapter-${chapter.slug}-title`}>{chapter.cardTitle}</h4>
                      <p className={styles.chapterDescription}>{chapter.cardDescription}</p>
                      <ul className={styles.topicTags} aria-label="Topics covered">{chapter.topics.map(topic => <li key={topic}>{topic}</li>)}</ul>
                      <div className={styles.cardBottom}>
                        <div className={styles.chapterMeta}><span><FiBookOpen aria-hidden="true" />{chapter.lessons} lessons</span><span><FiCode aria-hidden="true" />{chapter.checkpoints} {chapter.checkpoints === 1 ? 'checkpoint' : 'checkpoints'}</span></div>
                        {(inProgress || complete) && <div className={styles.cardProgress}><span>{complete ? 'Completed' : read ? `${read} of ${chapter.lessons} lessons read` : 'In progress'}</span><span className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${complete ? 100 : read / chapter.lessons * 100}%` }} /></span></div>}
                        <span className={styles.cardAction}>{complete ? 'Revisit chapter' : inProgress ? 'Continue chapter' : 'Start chapter'}<FiArrowRight aria-hidden="true" /></span>
                      </div>
                    </Link>
                  </li>;
                })}
              </ol>
            </>}
          </div>
        </div>
      </section>
      <footer className={styles.notes}><p>Read at your own pace. Each chapter has its own workspace.</p><Link prefetch={false} href="/learn/os/reference">Find a specific explanation <FiArrowRight aria-hidden="true" /></Link></footer>
    </div>
  </CourseShell>;
}
Course.coursePage = true;
export function getStaticProps() {
  return { props: {
    courseTitle,
    roadmap: chapters.map(chapter => {
      const guide = guidedAssemblyBySlug[chapter.slug] || (chapter.slug === 'bootloading' ? guidedKernel : makeProjectGuide(chapter));
      const directory = chapterDirectory[chapter.slug];
      return { ...chapterSummary(chapter), cardTitle: directory.title, cardDescription: directory.description, topics: directory.topics, checkpoints: guide.steps.length };
    }),
    lessonCount: chapters.reduce((count, chapter) => count + chapter.sections.length, 0),
  } };
}
