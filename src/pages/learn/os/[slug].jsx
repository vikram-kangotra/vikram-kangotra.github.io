/* global Set */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheck, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiCode, FiDownload, FiExternalLink, FiGrid, FiList, FiLock, FiMaximize2, FiMinimize2, FiAnchor, FiTerminal, FiX } from 'react-icons/fi';
import { SEO } from '@/components/ui';
import { chapters, chapterSummary } from '@/course';
import { guidedAssemblyBySlug } from '@/course/guidedAssembly';
import { guidedKernel } from '@/course/guidedKernel';
import { makeProjectGuide } from '@/course/guidedBuild';
import { getCExerciseTests } from '@/course/cExerciseTests';
import { makeCheckpointBrief } from '@/course/checkpointBriefs';
import { assemblyReadingAids } from '@/course/assemblyReadingAids';
import { systemsReadingAids } from '@/course/systemsReadingAids';
import { getLessonGate, isCheckpointSkipped } from '@/course/lessonAccess';
import CourseShell from '@/components/course/CourseShell';
import ChapterOutline from '@/components/course/ChapterOutline';
import CodeBlock from '@/components/course/CodeBlock';
import LessonVisual from '@/components/course/LessonVisual';
import CheckpointBrief from '@/components/course/CheckpointBrief';
import { LessonIntroduction, LessonReasoning } from '@/components/course/LessonTeaching';
import useCourseProgress from '@/components/course/useCourseProgress';
import styles from '@/components/course/chapter-workspace.module.css';

const ConceptLab = dynamic(() => import('@/components/course/ConceptLab'), { loading: () => <p>Loading the visual model…</p> });
const BootMachine = dynamic(() => import('@/components/course/BootMachine'), { ssr: false, loading: () => <div className={styles.loading}><FiTerminal /><p>Preparing your project workspace…</p></div> });
const clampSplit = (value) => Math.min(60, Math.max(35, Number(value) || 45));
function Inline({ text }) { return <>{text.split(/(`[^`]+`)/g).map((part, i) => part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part)}</>; }
function Tabs({ id, label, items, active, onChange }) {
  function key(event, index) {
    const offset = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const next = offset ? (index + offset + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); onChange(items[next].id); document.getElementById(`${id}-tab-${items[next].id}`)?.focus();
  }
  return <div className={styles.tabs} role="tablist" aria-label={label}>{items.map((item, i) => <button key={item.id} id={`${id}-tab-${item.id}`} type="button" role="tab" aria-selected={active === item.id} aria-controls={`${id}-panel-${item.id}`} tabIndex={active === item.id ? 0 : -1} onClick={() => onChange(item.id)} onKeyDown={(event) => key(event, i)}>{item.icon}{item.label}</button>)}</div>;
}
export default function Chapter(props) {
  return <CourseShell immersive context="BUILDING AN OS FROM SCRATCH"><ChapterWorkspace key={props.chapter.slug} {...props} /></CourseShell>;
}
Chapter.coursePage = true;

function ChapterWorkspace({ chapter, roadmap, previous, next }) {
  const router = useRouter();
  const { progress, update: updateProgress, loaded, storageAvailable } = useCourseProgress();
  const state = progress[chapter.slug] || {};
  const update = (patch) => updateProgress(chapter.slug, patch);
  const machinePractice = chapter.lab === 'boot';
  const chapterNumber = String(roadmap.findIndex((item) => item.slug === chapter.slug) + 1).padStart(2, '0');
  const [lessonIndex, setLessonIndex] = useState(0);
  const [readerTab, setReaderTab] = useState('lesson');
  const [practiceTab, setPracticeTab] = useState('machine');
  const [mobilePane, setMobilePane] = useState('reading');
  const [focusMode, setFocusMode] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceMounted, setWorkspaceMounted] = useState(false);
  const [workspacePinned, setWorkspacePinned] = useState(false);
  const workspaceTrigger = useRef(null);
  const [split, setSplit] = useState(45);
  const [dragging, setDragging] = useState(false);
  const [chapterQuery, setChapterQuery] = useState('');
  const [restored, setRestored] = useState(false);
  const [navigationNotice, setNavigationNotice] = useState(null);
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const checkpointBusyRef = useRef(false);
  const onCheckpointBusyChange = useCallback((busy) => {
    checkpointBusyRef.current = busy;
    setCheckpointBusy(busy);
  }, []);
  const dialog = useRef(null);
  const curriculumTrigger = useRef(null);
  const columns = useRef(null);
  const readerScroll = useRef(null);
  const practiceBody = useRef(null);
  const practiceScroll = useRef(null);
  const practicePositions = useRef({});
  const lessonHeading = useRef(null);
  const readerPositions = useRef({});
  const section = chapter.sections[lessonIndex];
  const workspaceKey = `vk-os-workspace-v2:${chapter.slug}`;
  const readLessons = state.lessons || [];
  const guide = chapter.guide;
  const gate = getLessonGate(chapter, state);
  const gateLessonIndex = gate?.lessonIndex;
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const blockedLesson = loaded && gate && lessonIndex > gate.lessonIndex;
  const lessonLocked = (index) => !!gate && index > gate.lessonIndex;
  const lockReason = (index) => lessonLocked(index) ? `Pass or skip the checkpoint in lesson ${gate.lessonIndex + 1} to unlock this lesson.` : '';
  const upcomingStep = guide.steps.findIndex(step => chapter.sections.findIndex(item => item.id === step.sectionId) >= lessonIndex);
  const buildIndex = upcomingStep < 0 ? guide.steps.length - 1 : upcomingStep;
  const buildStep = guide.steps[buildIndex];
  const atCheckpoint = buildStep.sectionId === section.id;
  const checkpointReady = atCheckpoint && (state.openBuilds || []).includes(buildIndex);
  const checkpointPassed = (buildStep.tests ? state.behaviorChecks || [] : state.buildSteps || []).includes(buildIndex);
  const checkpointSkipped = !checkpointPassed && isCheckpointSkipped(buildIndex, state);
  const skippedBuilds = guide.steps.filter((step, index) => isCheckpointSkipped(index, state) && !(step.tests ? state.behaviorChecks || [] : state.buildSteps || []).includes(index)).length;
  const allBuildsPassed = guide.steps.every((step, index) => (step.tests ? state.behaviorChecks || [] : state.buildSteps || []).includes(index));
  const lessonSkipped = (index) => guide.steps.some((step, stepIndex) => step.sectionId === chapter.sections[index].id && isCheckpointSkipped(stepIndex, state) && !(step.tests ? state.behaviorChecks || [] : state.buildSteps || []).includes(stepIndex));
  const chapterAttempted = (state.buildAttempts || []).includes(guide.steps.length - 1);
  const longCode = section.code && /^(asm|c|cpp)$/i.test(section.code.language) && (section.code.source.split('\n').length > 12 || section.code.source.includes('; --- Your lesson program starts here ---'));
  const diagramAfter = Math.min(section.paragraphs.length, Math.max(1, section.teaching?.diagramAfter || 2));
  const sectionAttempted = atCheckpoint && (state.buildAttempts || []).includes(buildIndex);

  const labComplete = machinePractice ? allBuildsPassed : !!state.lab;
  const ready = !!state.read && labComplete && allBuildsPassed;
  const completed = !!state.complete && ready;
  const passedBuilds = guide.steps.filter((step, index) => (step.tests ? state.behaviorChecks || [] : state.buildSteps || []).includes(index)).length;
  const firstUnpassed = guide.steps.findIndex((step, index) => !(step.tests ? state.behaviorChecks || [] : state.buildSteps || []).includes(index));
  const firstUnread = chapter.sections.findIndex((_, index) => !readLessons.includes(index));
  const remaining = [
    ...(!state.read ? [`Read ${Math.max(1, chapter.sections.length - readLessons.length)} remaining lesson${chapter.sections.length - readLessons.length === 1 ? '' : 's'}.`] : []),
    ...(!allBuildsPassed ? [`Pass ${guide.steps.length - passedBuilds} remaining coding checkpoint${guide.steps.length - passedBuilds === 1 ? '' : 's'}: ${guide.steps[firstUnpassed].title}.`] : []),
    ...(!machinePractice && !state.lab ? ['Solve the chapter’s visual model.'] : []),
  ];
  const steps = [
    { label: 'Read the lessons', detail: `${state.read ? chapter.sections.length : readLessons.length} of ${chapter.sections.length} read`, done: state.read, action: () => goLesson(firstUnread < 0 ? lessonIndex : firstUnread) },
    { label: 'Pass the coding checkpoints', detail: `${passedBuilds} of ${guide.steps.length} passed`, done: allBuildsPassed, action: () => openCheckpoint(firstUnpassed < 0 ? guide.steps.length - 1 : firstUnpassed) },
    ...(!machinePractice ? [{ label: 'Solve the visual model', detail: state.lab ? 'Prediction checked' : 'Explore the model and test your prediction', done: state.lab, action: () => openPractice('explore', 'experiment') }] : []),
  ];
  const readerTabs = [{ id: 'lesson', label: 'Lesson', icon: <FiBookOpen /> }, { id: 'overview', label: 'Outline', icon: <FiList /> }, { id: 'review', label: 'Progress', icon: <FiCheckCircle /> }];
  const practiceTabs = [{ id: 'machine', label: 'Workspace', icon: <FiTerminal /> }, ...(!machinePractice ? [{ id: 'explore', label: 'Visualize', icon: <FiGrid /> }] : [])];
  const labContext = { '12': 'Connect the block layer to its first client: repair the FAT chain, then explain which cluster reads become sector requests.', '15': 'Trace what happens before a shell executes a program: repair its ELF load description and account for the memory the loader creates.', '16': 'This model revisits legacy 32-bit, two-level paging. Compare it with the four-level x86-64 walk in the lesson; test long mode using QEMU.', '17': 'This model uses one CPU. Compare its accounting with multiple run queues; it does not simulate APIC delivery or SMP.' }[chapter.id];

  const practiceScroller = useCallback(() => {
    return practiceScroll.current && window.getComputedStyle(practiceScroll.current).overflowY !== 'visible' ? practiceScroll.current : practiceBody.current;
  }, []);
  const focusPracticeTarget = useCallback((id) => {
    const target = document.getElementById(id);
    const scroller = practiceScroller();
    if (!target || !scroller) return;
    scroller.scrollTop = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    target.focus({ preventScroll: true });
  }, [practiceScroller]);

  useEffect(() => {
    if (!loaded) return;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(workspaceKey) || '{}') || {}; setSplit(clampSplit(localStorage.getItem('vk-os-pane-split'))); localStorage.setItem('vk-os-last-chapter', chapter.slug); } catch { /* Keep a usable default workspace. */ }
    const savedIndex = chapter.sections.findIndex((item) => item.id === saved.lesson);
    if (savedIndex >= 0) {
      const prerequisite = gateRef.current;
      const blocked = prerequisite && savedIndex > prerequisite.lessonIndex;
      setLessonIndex(blocked ? prerequisite.lessonIndex : savedIndex);
      if (blocked) setNavigationNotice({ requested: savedIndex, ...prerequisite });
    }
    if (['lesson', 'overview', 'review'].includes(saved.readerTab)) setReaderTab(saved.readerTab);
    if (['machine', ...(!machinePractice ? ['explore'] : [])].includes(saved.practiceTab)) setPracticeTab(saved.practiceTab);
    if (saved.practiceTab === 'code') setReaderTab('review');
    if (saved.workspaceOpen && saved.practiceTab !== 'code') { setWorkspaceOpen(true); setWorkspaceMounted(true); }
    setWorkspacePinned(!!saved.workspacePinned);
    function followHash() {
      const hash = window.location.hash.slice(1);
      const index = chapter.sections.findIndex((item) => `lesson-${item.id}` === hash);
      if (index >= 0) {
        const prerequisite = gateRef.current;
        const blocked = prerequisite && index > prerequisite.lessonIndex;
        const destination = blocked ? prerequisite.lessonIndex : index;
        setLessonIndex(destination); setReaderTab('lesson'); setMobilePane('reading'); setFocusMode(false);
        setNavigationNotice(blocked ? { requested: index, ...prerequisite } : null);
        if (blocked) replaceHash(`lesson-${chapter.sections[destination].id}`);
        requestAnimationFrame(() => readerScroll.current?.scrollTo({ top: 0 }));
      }
      else if (['machine-lab', 'experiment'].includes(hash)) {
        setPracticeTab(hash === 'experiment' && !machinePractice ? 'explore' : 'machine'); setWorkspaceMounted(true); setWorkspaceOpen(true); setMobilePane('practice');
      } else if (['workshop', 'explain'].includes(hash)) { setReaderTab('review'); setMobilePane('reading'); }
      else if (hash === 'chapter-guide' || hash === 'checkpoint') { setReaderTab(hash === 'chapter-guide' ? 'overview' : 'review'); setMobilePane('reading'); }
      else if (hash === 'read' || hash === 'chapter-reading') { setReaderTab('lesson'); setMobilePane('reading'); }
    }
    followHash(); setRestored(true);
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, [loaded, chapter.sections, chapter.slug, focusPracticeTarget, machinePractice, workspaceKey]);
  useEffect(() => {
    if (!loaded || !restored || blockedLesson) return;
    try { localStorage.setItem(workspaceKey, JSON.stringify({ lesson: section.id, readerTab, practiceTab, workspaceOpen, workspacePinned })); } catch { /* Draft and navigation persistence is optional. */ }
  }, [section.id, readerTab, practiceTab, workspaceOpen, workspacePinned, loaded, restored, blockedLesson, workspaceKey]);
  // A pass can be revoked by editing an earlier checkpoint or by progress syncing
  // from another tab. Never leave a now-locked lesson or workspace active.
  useEffect(() => {
    if (!loaded || !restored || !blockedLesson) return;
    const prerequisite = gateRef.current;
    setNavigationNotice({ requested: lessonIndex, ...prerequisite });
    setLessonIndex(prerequisite.lessonIndex); setReaderTab('lesson'); setMobilePane('reading');
    setWorkspaceOpen(false); setWorkspacePinned(false); setFocusMode(false);
    replaceHash(`lesson-${chapter.sections[prerequisite.lessonIndex].id}`);
    requestAnimationFrame(() => { readerScroll.current?.scrollTo({ top: 0 }); lessonHeading.current?.focus({ preventScroll: true }); });
  }, [loaded, restored, blockedLesson, lessonIndex, chapter.sections]);
  useEffect(() => {
    if (navigationNotice && (gateLessonIndex === undefined || gateLessonIndex >= navigationNotice.requested)) setNavigationNotice(null);
  }, [gateLessonIndex, navigationNotice]);
  function replaceHash(hash) { window.history.replaceState(window.history.state, '', `#${hash}`); }
  function selectReaderTab(tab) {
    readerPositions.current[readerTab] = readerScroll.current?.scrollTop || 0;
    setReaderTab(tab); setMobilePane('reading'); setFocusMode(false);
    if (!workspacePinned) setWorkspaceOpen(false);
    replaceHash(tab === 'lesson' ? `lesson-${section.id}` : tab === 'overview' ? 'chapter-guide' : 'checkpoint');
    requestAnimationFrame(() => { if (readerScroll.current) readerScroll.current.scrollTop = readerPositions.current[tab] || 0; });
  }
  function goLesson(index, moveFocus = true) {
    if (!loaded) return false;
    const prerequisite = gateRef.current;
    if (prerequisite && index > prerequisite.lessonIndex) {
      setNavigationNotice({ requested: index, ...prerequisite });
      return false;
    }
    setNavigationNotice(null);
    setLessonIndex(index); setReaderTab('lesson'); setMobilePane('reading'); setFocusMode(false);
    if (!workspacePinned) setWorkspaceOpen(false);
    replaceHash(`lesson-${chapter.sections[index].id}`);
    requestAnimationFrame(() => { readerScroll.current?.scrollTo({ top: 0 }); if (moveFocus) lessonHeading.current?.focus({ preventScroll: true }); });
    return true;
  }
  function advanceLesson() {
    if (!loaded || blockedLesson) return;
    if (atCheckpoint && !checkpointPassed && !checkpointSkipped) { openCheckpoint(buildIndex); return; }
    const lessons = [...new Set([...readLessons, lessonIndex])];
    update({ lessons, read: lessons.length === chapter.sections.length || !!state.read });
    if (lessonIndex + 1 < chapter.sections.length) goLesson(lessonIndex + 1);
    else { selectReaderTab('review'); requestAnimationFrame(() => document.getElementById('checkpoint-heading')?.focus()); }
  }
  function completeLesson() {
    if (atCheckpoint && !checkpointPassed && !checkpointSkipped) {
      openCheckpoint(buildIndex); return;
    }
    advanceLesson();
  }
  function skipCheckpoint() {
    if (!loaded || blockedLesson || !atCheckpoint || checkpointPassed || checkpointBusyRef.current) return;
    const lessons = [...new Set([...readLessons, lessonIndex])];
    const patch = { skippedCheckpoints: [...new Set([...(state.skippedCheckpoints || []), buildIndex])], lessons, read: lessons.length === chapter.sections.length || !!state.read, complete: false };
    update(patch);
    // Allow this deliberate navigation immediately, before React publishes progress.
    gateRef.current = getLessonGate(chapter, { ...state, ...patch });
    if (lessonIndex + 1 < chapter.sections.length) goLesson(lessonIndex + 1);
    else { setNavigationNotice(null); selectReaderTab('review'); requestAnimationFrame(() => document.getElementById('checkpoint-heading')?.focus()); }
  }
  function recordAttempt() { update({ buildAttempts: [...new Set([...(state.buildAttempts || []), buildIndex])] }); }
  function recordBuild() { update({ skippedCheckpoints: (state.skippedCheckpoints || []).filter(index => index !== buildIndex), buildSteps: [...new Set([...(state.buildSteps || []), buildIndex])], ...(buildStep.tests ? { behaviorChecks: [...new Set([...(state.behaviorChecks || []), buildIndex])] } : {}), ...(buildIndex === guide.steps.length - 1 && machinePractice ? { assembly: true } : {}) }); }
  function invalidateBuild() { update({ buildSteps: (state.buildSteps || []).filter(index => index < buildIndex), behaviorChecks: (state.behaviorChecks || []).filter(index => index < buildIndex), buildRuns: (state.buildRuns || []).filter(index => index < buildIndex), assembly: false, complete: false }); }
  function openPractice(tab, target) {
    if (!loaded || blockedLesson) return;
    practicePositions.current[practiceTab] = practiceScroller()?.scrollTop || 0;
    setPracticeTab(tab); setWorkspaceMounted(true); setWorkspaceOpen(true); setMobilePane('practice');
    if (target) replaceHash(target);
    requestAnimationFrame(() => { if (target) focusPracticeTarget(target); else { const scroller = practiceScroller(); if (scroller) scroller.scrollTop = practicePositions.current[tab] || 0; } });
  }
  function closeWorkspace() {
    setWorkspaceOpen(false); setWorkspacePinned(false); setFocusMode(false); setMobilePane('reading');
    replaceHash(readerTab === 'lesson' ? `lesson-${section.id}` : readerTab === 'overview' ? 'chapter-guide' : 'checkpoint');
    requestAnimationFrame(() => workspaceTrigger.current?.focus());
  }
  function openCheckpoint(index) {
    if (!loaded) return;
    const requested = chapter.sections.findIndex(item => item.id === guide.steps[index].sectionId);
    const prerequisite = gateRef.current;
    const blocked = prerequisite && requested > prerequisite.lessonIndex;
    if (blocked) index = prerequisite.stepIndex;
    const sectionIndex = chapter.sections.findIndex(item => item.id === guide.steps[index].sectionId);
    if (!goLesson(sectionIndex, false)) return;
    if (blocked) setNavigationNotice({ requested, ...prerequisite });
    update({ openBuilds: [...new Set([...(state.openBuilds || []), index])] });
    openPractice('machine', 'machine-lab');
    requestAnimationFrame(() => document.getElementById('section-checkpoint')?.scrollIntoView({ block: 'start' }));
  }
  function resize(value) { const nextSplit = clampSplit(value); setSplit(nextSplit); try { localStorage.setItem('vk-os-pane-split', String(nextSplit)); } catch { /* Keep the current layout. */ } }
  function drag(event) { if (!dragging || !columns.current) return; const rect = columns.current.getBoundingClientRect(); resize((event.clientX - rect.left) / rect.width * 100); }
  function resizeKey(event) { const value = event.key === 'ArrowLeft' ? split - 2 : event.key === 'ArrowRight' ? split + 2 : event.key === 'Home' ? 35 : event.key === 'End' ? 60 : null; if (value !== null) { event.preventDefault(); resize(value); } }
  function showCurriculum() { setChapterQuery(''); dialog.current?.showModal(); }
  function closeCurriculum() { dialog.current?.close(); curriculumTrigger.current?.focus(); }
  function chooseChapter(slug) { closeCurriculum(); if (slug !== chapter.slug) router.push(`/learn/os/${slug}`); }
  const matchingChapters = roadmap.filter((item) => `${item.id} ${item.title} ${item.subtitle} ${item.phase} ${item.slug}`.toLowerCase().includes(chapterQuery.trim().toLowerCase()));

  return <>
    <SEO title={`${chapter.title} — Building an OS from Scratch`} description={chapter.subtitle} path={`/learn/os/${chapter.slug}`} />
    <nav className={styles.chapterBar} aria-label="Chapter navigation">
      <button ref={curriculumTrigger} className={styles.curriculumButton} onClick={showCurriculum} aria-label="Curriculum" aria-haspopup="dialog"><FiList /><span>Curriculum</span><FiChevronDown /></button>
      <div className={styles.chapterIdentity}><span className={styles.chapterIndex}>{chapterNumber} / {roadmap.length}</span><h1>{chapter.title}</h1></div>
      <div className={styles.chapterArrows}>{previous ? <Link prefetch={false} href={`/learn/os/${previous.slug}`} aria-label={`Previous chapter: ${previous.title}`} title={previous.title}><FiChevronLeft /></Link> : <span aria-hidden="true"><FiChevronLeft /></span>}{next ? <Link prefetch={false} href={`/learn/os/${next.slug}`} aria-label={`Next chapter: ${next.title}`} title={next.title}><FiChevronRight /></Link> : <span aria-hidden="true"><FiChevronRight /></span>}</div>
      <span className={styles.chapterState}>{completed ? <><FiCheckCircle /> Completed</> : <><span className={styles.statusDot} /> In progress</>}</span>
    </nav>
    {workspaceOpen && <div className={styles.mobileTabs} aria-label="Workspace view"><button aria-pressed={mobilePane === 'reading'} onClick={() => setMobilePane('reading')}><FiBookOpen /> Lesson</button><button aria-pressed={mobilePane === 'practice'} onClick={() => setMobilePane('practice')}><FiTerminal /> {practiceTab === 'explore' ? 'Visual model' : 'Workspace'}</button></div>}
    <div ref={columns} className={styles.columns} data-mobile-pane={mobilePane} data-workspace={workspaceOpen} data-focus={focusMode} data-dragging={dragging} style={{ '--reading-width': `${split}fr`, '--practice-width': `${100 - split}fr` }}>
      <aside className={styles.chapterRail} hidden={workspaceOpen}>
        <ChapterOutline chapter={chapter} lessonIndex={lessonIndex} readLessons={readLessons} guide={guide} state={state} gate={gate} onSelectLesson={goLesson} />
      </aside>
      <section id="chapter-reading" className={styles.reading} aria-label="Chapter reading">
        <div className={styles.paneTop}><Tabs id="reader" label="Reading views" items={readerTabs} active={readerTab} onChange={selectReaderTab} /><button ref={workspaceTrigger} className={styles.workspaceToggle} aria-label={workspaceOpen ? 'Hide workspace' : 'Open workspace'} aria-expanded={workspaceOpen} aria-controls="chapter-practice" onClick={() => workspaceOpen ? closeWorkspace() : openPractice('machine', 'machine-lab')} title={workspaceOpen ? 'Hide workspace' : 'Open workspace'}><FiTerminal /><span>{workspaceOpen ? 'Hide workspace' : 'Open workspace'}</span></button></div>
        {navigationNotice && <div className={styles.accessNotice} role="status" aria-label="Lesson access"><FiLock aria-hidden="true" /><div><strong>Lesson {navigationNotice.requested + 1} is locked.</strong><p>Pass or skip the checkpoint in lesson {navigationNotice.lessonIndex + 1} to continue: {guide.steps[navigationNotice.stepIndex].title}.</p><button type="button" onClick={() => openCheckpoint(navigationNotice.stepIndex)}>Open required checkpoint <FiArrowRight aria-hidden="true" /></button></div></div>}
        <div ref={readerScroll} className={styles.readerScroll}>
          <div id="reader-panel-lesson" role="tabpanel" aria-labelledby="reader-tab-lesson" hidden={readerTab !== 'lesson' || blockedLesson} tabIndex={0}>
            <article id={`lesson-${section.id}`} className={styles.lesson}>
              <div className={styles.lessonMeta}><span>{chapter.phase}</span><span>Lesson {lessonIndex + 1} of {chapter.sections.length}</span>{readLessons.includes(lessonIndex) && <span className={styles.readBadge}><FiCheck /> Read</span>}</div>
              <h2 ref={lessonHeading} tabIndex={-1}>{section.title.replace(/^\s*\d+(?:\.\d+)*\s*[.)\-–—:]\s*/, '')}</h2>
              <LessonIntroduction teaching={section.teaching} />
              <div className={styles.prose}>{section.paragraphs.slice(0, diagramAfter).map((text, i) => <p key={i}><Inline text={text} /></p>)}</div>
              {section.aid && <LessonVisual aid={section.aid} />}
              <div className={styles.prose}>{section.paragraphs.slice(diagramAfter).map((text, i) => <p key={i}><Inline text={text} /></p>)}</div>
              {section.code && !longCode && <CodeBlock code={section.code} />}
              {section.code && longCode && <aside className={styles.callout}><FiCode /><div><strong>Build this part step by step.</strong><p>{guide.kind === 'assembly' ? <>Practice this idea in <code>lesson.asm</code>; put any data declarations in <code>data.inc</code>. The coding checkpoint specifies which part to write and which inputs the lab supplies.</> : <>Use the explanation to implement <code>{section.code.filename}</code> in your growing project.</>} Open the checkpoint’s hints or peek at an answer whenever you need help.</p>{guide.kind === 'project' && <details><summary>Peek at this section’s reference</summary><CodeBlock code={section.code.source.includes('; --- Your lesson program starts here ---') ? { ...section.code, source: section.code.source.split('lesson:\n')[1].split('; --- End of lesson program ---')[0] } : section.code} /></details>}</div></aside>}
              {section.callout && <aside className={styles.callout}><FiBookOpen /><div><strong>{section.callout.title}</strong><p><Inline text={section.callout.text} /></p></div></aside>}
              <LessonReasoning key={`${chapter.slug}:${section.id}`} teaching={section.teaching} chapterSlug={chapter.slug} sectionId={section.id} />
              {atCheckpoint && <div id="section-checkpoint"><CheckpointBrief brief={buildStep.brief} interfaceCode={buildStep.interface ? { language: 'c', filename: guide.file, source: buildStep.interface } : undefined} /></div>}
              {atCheckpoint && <div className={styles.tryCard}><span className={styles.tryIcon}><FiTerminal /></span><div><strong>{checkpointPassed ? 'Checkpoint passed.' : checkpointSkipped ? 'Checkpoint skipped.' : checkpointReady ? 'Your coding checkpoint is ready.' : 'Put this lesson into practice.'}</strong><p>{checkpointPassed ? 'Continue when you are ready, or reopen your code to experiment.' : checkpointSkipped ? 'You can continue reading. Reopen this task whenever you want to submit it; skipping does not count as a pass.' : 'Open the editor. Use Run to try your code and Submit to check this checkpoint. Hints and an optional answer are available in Check.'}</p></div><button onClick={() => openCheckpoint(buildIndex)} aria-label="Open this section’s coding checkpoint"><FiArrowRight /></button></div>}
              {atCheckpoint && !checkpointPassed && !checkpointSkipped && !workspaceOpen && <div className={styles.skipCheckpoint}><button type="button" disabled={checkpointBusy} onClick={skipCheckpoint}>Skip checkpoint</button><span>{checkpointBusy ? 'Wait for the current run or submission to finish, or stop it in the workspace.' : 'Continue reading and return to this task later. It will be marked Skipped.'}</span></div>}

            </article>
          </div>
          <div id="reader-panel-overview" role="tabpanel" aria-labelledby="reader-tab-overview" hidden={readerTab !== 'overview'} tabIndex={0} className={styles.guide}>
            <span className={styles.eyebrow}>CHAPTER {chapterNumber} · {chapter.phase}</span><h2>{chapter.title}</h2><p className={styles.lead}>{chapter.subtitle}</p><div className={styles.guideMeta}><span><FiClock /> {chapter.minutes} min guided work</span><span><FiBookOpen /> {chapter.sections.length} lessons</span></div>
            <h3>What you’ll build and understand</h3><ul className={styles.outcomes}>{chapter.outcomes.map((item) => <li key={item}><FiCheck /><span>{item}</span></li>)}</ul>
            <details className={styles.prerequisites}><summary>Before you begin</summary><ul>{chapter.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></details>
            <h3>Your route through this chapter</h3><ol className={styles.lessonList}>{chapter.sections.map((item, i) => <li key={item.id}><button onClick={() => goLesson(i)} data-lesson-index={i} data-locked={lessonLocked(i)} aria-disabled={lessonLocked(i) || undefined} aria-describedby={lessonLocked(i) || lessonSkipped(i) ? `outline-status-${item.id}` : undefined} title={lockReason(i) || undefined} aria-current={lessonIndex === i ? 'step' : undefined}><span className={readLessons.includes(i) ? styles.lessonDone : ''}>{readLessons.includes(i) ? <FiCheck /> : String(i + 1).padStart(2, '0')}</span><span>{item.title}</span>{lessonLocked(i) ? <><small>Finish lesson {gate.lessonIndex + 1}</small><FiLock aria-hidden="true" /></> : <>{lessonSkipped(i) ? <small>Skipped</small> : lessonIndex === i && <small>Current</small>}<FiChevronRight /></>}</button>{(lessonLocked(i) || lessonSkipped(i)) && <span id={`outline-status-${item.id}`} hidden>{lessonLocked(i) ? `Locked. ${lockReason(i)}` : 'Checkpoint skipped, not passed.'}</span>}</li>)}</ol>
            <div className={styles.resources}><h3>Continue with the sources</h3>{chapter.sources.filter(source => !source.url.startsWith('/course/') || (state.read && chapterAttempted)).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<FiExternalLink /></a>)}{state.read && chapterAttempted && <a href="/course/module-1-source.tar.gz" download><span><FiDownload /> Module 1 reference project — compare after your build</span><FiArrowRight /></a>}</div>
          </div>
          <div id="reader-panel-review" role="tabpanel" aria-labelledby="reader-tab-review" hidden={readerTab !== 'review'} tabIndex={0} className={styles.checkpoint}>
            <span className={styles.eyebrow}>CHAPTER PROGRESS</span><h2 id="checkpoint-heading" tabIndex={-1}>{completed ? 'Chapter completed.' : 'Your next steps.'}</h2><p className={styles.lead}>Follow your progress through the lessons and guided practice. Your work stays saved on this device.</p>
            <div className={styles.checkpointSteps}>{steps.map((step, i) => <button key={step.label} onClick={step.action} className={step.done ? styles.stepComplete : ''}><span>{step.done ? <FiCheck /> : String(i + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><FiArrowRight /></button>)}</div>
            <label className={styles.readCheck}><input type="checkbox" checked={!!state.read} onChange={(event) => update({ read: event.target.checked, lessons: event.target.checked ? chapter.sections.map((_, i) => i) : [], complete: false })} /><span>I have read the chapter and traced its worked examples.</span></label>
            {!ready && <div className={styles.remaining} id="chapter-remaining"><strong>Before you finish</strong><ul>{remaining.map(item => <li key={item}>{item}</li>)}</ul></div>}
            <button className={styles.completeButton} aria-describedby={!ready ? 'chapter-remaining' : undefined} disabled={!loaded || !ready || completed} onClick={() => update({ complete: true })}>{completed ? <><FiCheckCircle /> Chapter completed</> : <>Complete chapter <FiArrowRight /></>}</button>
            {skippedBuilds > 0 && <p className={styles.small} role="status">{skippedBuilds} checkpoint{skippedBuilds === 1 ? ' is' : 's are'} marked Skipped. You can keep reading and return to submit them later. Skipped tasks do not count as passed.</p>}
            <p className={styles.small}>Completion records the guided practice above. Building and validating these ideas in your full kernel is a separate milestone.</p>
            {guide.kind === 'project' && <details className={styles.experiments}><summary>Further experiments <span>Optional</span></summary><p>Use these cases to review or extend your experiments. Some require additional kernel facilities. Record a case after you have run it; these notes do not affect chapter completion or independently verify your kernel. Editing your code clears them.</p><fieldset><legend>Cases you have tried</legend>{chapter.challenge.checks.map((text, index) => <label key={text}><input type="checkbox" checked={(state.checks || []).includes(index)} onChange={() => update({ checks: (state.checks || []).includes(index) ? state.checks.filter(item => item !== index) : [...(state.checks || []), index] })} /><span>{text}</span></label>)}</fieldset></details>}
            {!storageAvailable && <p role="status">Browser storage is unavailable. Download your code before leaving.</p>}
            <div className={styles.carry}><span className={styles.eyebrow}>CARRY IT INTO YOUR KERNEL</span><p>{chapter.nextBuild}</p></div>
            {next && <Link prefetch={false} className={styles.nextChapter} href={`/learn/os/${next.slug}`}><div><small>UP NEXT · CHAPTER {next.id}</small><strong>{next.title}</strong></div><FiArrowRight /></Link>}
          </div>
        </div>
        <footer className={styles.lessonFooter}><button className={styles.previousLesson} disabled={readerTab === 'lesson' && lessonIndex === 0} onClick={() => readerTab !== 'lesson' ? selectReaderTab('lesson') : goLesson(lessonIndex - 1)}><FiChevronLeft /><span>{readerTab === 'lesson' ? 'Previous' : 'Back to lesson'}</span></button><span className={styles.lessonCount}>{lessonIndex + 1} / {chapter.sections.length}</span><button className={styles.nextLesson} onClick={readerTab === 'lesson' ? completeLesson : () => selectReaderTab('lesson')}>{readerTab === 'lesson' ? atCheckpoint && !checkpointPassed && !checkpointSkipped ? checkpointReady ? 'Return to coding checkpoint' : 'Open coding checkpoint' : lessonIndex + 1 === chapter.sections.length ? 'Finish chapter reading' : 'Read & continue' : 'Continue reading'}<FiArrowRight /></button></footer>
      </section>
      <div hidden={!workspaceOpen} role="separator" aria-label="Resize reading and coding panes" aria-controls="chapter-reading" aria-orientation="vertical" aria-valuemin={35} aria-valuemax={60} aria-valuenow={Math.round(split)} tabIndex={0} className={styles.divider} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }} onPointerMove={drag} onPointerUp={(event) => { setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => setDragging(false)} onKeyDown={resizeKey} onDoubleClick={() => resize(45)} title="Drag to resize; arrow keys adjust; double-click to reset"><span /></div>
      <section id="chapter-practice" hidden={!workspaceOpen} className={styles.practice} aria-label="Interactive workspace">
        <h2 className={styles.srOnly}>Interactive workspace</h2>
        <div className={styles.paneTop}><Tabs id="practice" label="Practice tools" items={practiceTabs} active={practiceTab} onChange={openPractice} /><div className={styles.workspaceActions}><button className={styles.pinButton} aria-pressed={workspacePinned} aria-label="Keep workspace open while reading" title="Keep workspace open while reading" onClick={() => setWorkspacePinned(!workspacePinned)}><FiAnchor /></button><button className={styles.focusButton} onClick={() => setFocusMode(!focusMode)} aria-label={focusMode ? 'Restore split view' : 'Focus on code'} title={focusMode ? 'Restore split view' : 'Focus on code'}>{focusMode ? <FiMinimize2 /> : <FiMaximize2 />}</button><button className={styles.closeWorkspace} onClick={closeWorkspace} aria-label="Close workspace" title="Close workspace"><FiX /></button></div></div>
        <div ref={practiceBody} className={styles.practiceBody}>
          <div id="practice-panel-machine" role="tabpanel" aria-labelledby="practice-tab-machine" hidden={practiceTab !== 'machine'} className={styles.machinePanel}>
            <section id="machine-lab" tabIndex={-1} className={styles.machineContainer} aria-label="Project editor and x86 emulator">{workspaceMounted && <BootMachine chapterSlug={chapter.slug} exercise={chapter.assembly} guided={{ ...guide, step: buildStep, stepIndex: buildIndex, stepCount: guide.steps.length, ready: loaded && !blockedLesson && checkpointReady, attempted: sectionAttempted, sectionTitle: chapter.sections.find(item => item.id === buildStep.sectionId)?.title, onAttempt: recordAttempt, onBoot: () => update({ buildRuns: [...new Set([...(state.buildRuns || []), buildIndex])] }), onPassed: recordBuild, onContinue: completeLesson, onSkip: skipCheckpoint, onBusyChange: onCheckpointBusyChange, passed: checkpointPassed, skipped: checkpointSkipped }} onSourceChange={(code) => update({ code, checks: [], complete: false })} challengeEnabled={machinePractice} onSolved={() => update({ assembly: true })} onInvalidate={invalidateBuild} />}</section>
          </div>
          <div ref={practiceScroll} className={styles.practiceScroll} hidden={practiceTab === 'machine'}>

            {!machinePractice && <div id="practice-panel-explore" role="tabpanel" aria-labelledby="practice-tab-explore" hidden={practiceTab !== 'explore'} tabIndex={0}><section id="experiment" tabIndex={-1}>{labContext && <p className={styles.modelContext}>{labContext}</p>}<ConceptLab type={chapter.lab} onSolved={() => update({ lab: true })} />{state.lab && <p className={styles.modelSolved} role="status"><FiCheckCircle /> Prediction checked. Return to the lesson when you are ready.</p>}</section></div>}
          </div>
        </div>
      </section>
    </div>
    <dialog ref={dialog} className={styles.curriculumDialog} aria-labelledby="curriculum-heading" onKeyDownCapture={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeCurriculum(); } }} onClose={() => curriculumTrigger.current?.focus()} onClick={(event) => { if (event.target === dialog.current) closeCurriculum(); }}>
      <div className={styles.dialogInner}><header><div><span className={styles.eyebrow}>YOUR LEARNING PATH</span><h2 id="curriculum-heading">One layer at a time.</h2></div><button onClick={closeCurriculum} aria-label="Close curriculum"><FiX /></button></header><label className={styles.chapterSearch}><span className={styles.srOnly}>Search chapters</span><input type="search" value={chapterQuery} onChange={(event) => setChapterQuery(event.target.value)} placeholder="Find a chapter or concept…" autoComplete="off" /></label><nav aria-label="Course curriculum">{matchingChapters.map((item, i) => <div key={item.slug}>{(i === 0 || matchingChapters[i - 1].phase !== item.phase) && <h3>{item.phase}</h3>}<button aria-current={item.slug === chapter.slug ? 'page' : undefined} onClick={() => chooseChapter(item.slug)}><span>{progress[item.slug]?.complete ? <FiCheck /> : item.id}</span><span>{item.title}<small>{item.minutes} min guided work</small></span><FiChevronRight /></button></div>)}{!matchingChapters.length && <p className={styles.empty}>No matching chapters. Try “memory” or “boot”.</p>}</nav><footer><Link prefetch={false} href="/learn/os"><FiArrowLeft /> Course overview</Link><span>{roadmap.filter((item) => progress[item.slug]?.complete).length} / {roadmap.length} completed</span></footer></div>
    </dialog>
  </>;
}
export function getStaticPaths() { return { paths: chapters.map((chapter) => ({ params: { slug: chapter.slug } })), fallback: false }; }
export function getStaticProps({ params }) {
  const index = chapters.findIndex((chapter) => chapter.slug === params.slug);
  const exercise = getCExerciseTests(chapters[index]);
  const guide = guidedAssemblyBySlug[params.slug] ? { kind: 'assembly', ...guidedAssemblyBySlug[params.slug] } : params.slug === 'bootloading' ? guidedKernel : makeProjectGuide(chapters[index]);
  const aids = assemblyReadingAids[params.slug] || systemsReadingAids[params.slug] || {};
  return { props: { chapter: { ...chapters[index], sections: chapters[index].sections.map(section => ({ ...section, ...(aids[section.id] ? { aid: aids[section.id] } : {}) })), ...(exercise ? { challenge: { ...chapters[index].challenge, starter: exercise.starter, solution: exercise.reference } } : {}), guide: { ...guide, steps: guide.steps.map((step, stepIndex) => ({ ...step, brief: makeCheckpointBrief(chapters[index], guide, step, stepIndex) })) } }, roadmap: chapters.map(chapterSummary), previous: index > 0 ? chapterSummary(chapters[index - 1]) : null, next: index + 1 < chapters.length ? chapterSummary(chapters[index + 1]) : null } };
}
