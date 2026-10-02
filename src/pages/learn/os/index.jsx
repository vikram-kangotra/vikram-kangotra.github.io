/* global Set */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowRight, FiBookOpen, FiCheck, FiChevronRight, FiClock, FiCode, FiCpu, FiExternalLink, FiLayers, FiSearch, FiTerminal, FiX } from 'react-icons/fi';
import { SEO } from '@/components/ui';
import { chapters, chapterSummary, courseTitle } from '@/course';
import { isChapterComplete } from '@/course/lessonProgress';
import CourseShell from '@/components/course/CourseShell';
import useCourseProgress from '@/components/course/useCourseProgress';
import styles from '@/components/course/course-overview.module.css';

const phaseDetails = {
  'x86 Assembly': { description: 'Trace registers, memory, and calls, then implement your own character, string, and hexadecimal output routines.', icon: FiCode },
  Foundations: { description: 'Follow power-on into your own C code, then learn how the kernel handles hardware events.', icon: FiCpu },
  Memory: { description: 'Learn how the kernel finds free memory, maps addresses, and serves allocations.', icon: FiLayers },
  Processes: { description: 'Build the mechanisms that let programs run, take turns, and communicate.', icon: FiCode },
  Storage: { description: 'Follow a file request from a filename through clusters to disk sectors.', icon: FiLayers },
  Userland: { description: 'Use your kernel’s services to build a library and an interactive shell.', icon: FiTerminal },
  Beyond: { description: 'Extend the ideas to 64-bit booting, multiple CPUs, and a complete system.', icon: FiCpu },
};

function duration(minutes) {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}
function hasStarted(state) {
  return Boolean(state && (state.read || state.lessons?.length || state.lab || state.assembly || state.code || state.reflection));
}

export default function Course({ roadmap, lessonCount, courseTitle }) {
  const { progress, loaded, storageAvailable } = useCourseProgress();
  const [query, setQuery] = useState('');
  const [lastChapter, setLastChapter] = useState(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vk-os-last-chapter');
      if (roadmap.some((chapter) => chapter.slug === saved)) setLastChapter(saved);
    } catch { /* Resume falls back to saved progress or the first chapter. */ }
  }, [roadmap]);
  const done = roadmap.filter((chapter) => isChapterComplete(chapter, progress[chapter.slug])).length;
  const started = Boolean(lastChapter) || roadmap.some((chapter) => hasStarted(progress[chapter.slug]));
  const next = roadmap.find((chapter) => chapter.slug === lastChapter && !isChapterComplete(chapter, progress[chapter.slug]))
    || roadmap.find((chapter) => hasStarted(progress[chapter.slug]) && !isChapterComplete(chapter, progress[chapter.slug]))
    || roadmap.find((chapter) => !isChapterComplete(chapter, progress[chapter.slug])) || roadmap[0];
  const allComplete = done === roadmap.length;
  const visible = roadmap.filter((chapter) => `${chapter.title} ${chapter.subtitle} ${chapter.phase} ${chapter.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
  const phases = [...new Set(roadmap.map((chapter) => chapter.phase))];
  const percentage = Math.round(done / roadmap.length * 100);

  return <CourseShell context="Learning path">
    <SEO title={`${courseTitle}: Vikram Kangotra`} description="A hands-on systems engineering course. Read beside a real x86 machine, write assembly, and build a C kernel from the first instruction to userspace." path="/learn/os" />
    <div className={styles.dashboard}>
      <header className={styles.introduction}>
        <div className={styles.eyebrow}><span className={styles.courseMark}><FiCpu aria-hidden="true" /></span> SYSTEMS ENGINEERING <span className={styles.selfPaced}>Self-paced course</span></div>
        <h1>Building an OS<br className={styles.mobileBreak} /> from Scratch<span>.</span></h1>
        <p>Learn how a computer runs your code. We’ll start with a single x86 instruction, then build up to a bootloader, a C kernel, and programs that use it. Each lesson explains one idea, works through an example, and gives you a small piece to try.</p>
        <ul className={styles.courseFacts} aria-label="Course at a glance">
          <li><FiBookOpen aria-hidden="true" /><strong>{roadmap.length}</strong> chapters</li>
          <li><FiCode aria-hidden="true" />C + x86 assembly</li>
          <li><FiTerminal aria-hidden="true" />Code and run in your browser</li>
          <li><FiLayers aria-hidden="true" /><strong>{lessonCount}</strong> guided lessons</li>
        </ul>
      </header>

      <div className={styles.dashboardGrid}>
        <section id="roadmap" className={styles.curriculum} aria-labelledby="curriculum-title">
          <div className={styles.curriculumHeader}>
            <div><h2 id="curriculum-title">Your learning path</h2><p>Follow the chapters in order. Each new layer uses something you learned in the previous one.</p></div>
            <a className={styles.jumpToNext} href={`#phase-${next.phase.toLowerCase().replace(/\s+/g, '-')}`}>Jump to your stage <FiArrowRight aria-hidden="true" /></a>
          </div>
          <p className={styles.referenceLink}><Link href="/learn/os/reference">Browse the detailed topic reference: descriptors, paging, allocation, scheduling, storage, and more.</Link></p>
          <div className={styles.searchRow}>
            <label className={styles.search}>
              <FiSearch aria-hidden="true" />
              <span className={styles.srOnly}>Search chapters</span>
              <input type="search" placeholder="Search chapters, concepts, or tools…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            {query && <button className={styles.clearSearch} onClick={() => setQuery('')} aria-label="Clear search"><FiX aria-hidden="true" /></button>}
          </div>
          <div className={styles.resultCount} role="status" aria-live="polite">{query ? `${visible.length} ${visible.length === 1 ? 'chapter' : 'chapters'} matching “${query}”` : 'Explanations, worked examples, diagrams, reasoning questions, and coding checkpoints.'}</div>

          <div className={styles.phaseList}>
            {phases.map((phase, phaseIndex) => {
              const items = visible.filter((chapter) => chapter.phase === phase);
              if (!items.length) return null;
              const allInPhase = roadmap.filter((chapter) => chapter.phase === phase);
              const phaseDone = allInPhase.filter((chapter) => isChapterComplete(chapter, progress[chapter.slug])).length;
              const { description, icon: Icon } = phaseDetails[phase];
              return <section key={phase} id={`phase-${phase.toLowerCase().replace(/\s+/g, '-')}`} className={styles.phase} aria-labelledby={`phase-title-${phase.toLowerCase().replace(/\s+/g, '-')}`}>
                <header className={styles.phaseHeader}>
                  <span className={styles.phaseIcon}><Icon aria-hidden="true" /></span>
                  <div><div className={styles.phaseName}><span>0{phaseIndex + 1}</span><h3 id={`phase-title-${phase.toLowerCase().replace(/\s+/g, '-')}`}>{phase}</h3></div><p>{description}</p></div>
                  <span className={styles.phaseCount} aria-label={`${phaseDone} of ${allInPhase.length} chapters complete`}>{phaseDone}<span> / {allInPhase.length}</span></span>
                </header>
                <ol className={styles.chapters}>
                  {items.map((chapter) => {
                    const complete = isChapterComplete(chapter, progress[chapter.slug]);
                    const inProgress = hasStarted(progress[chapter.slug]) && !complete;
                    const isNext = chapter.slug === next.slug && !allComplete;
                    return <li key={chapter.slug}>
                      <Link href={`/learn/os/${chapter.slug}`} className={`${styles.chapterRow} ${isNext ? styles.nextChapter : ''}`} aria-current={isNext ? 'step' : undefined}>
                        <span className={`${styles.chapterNumber} ${complete ? styles.completedNumber : ''}`} aria-label={complete ? `Chapter ${chapter.id}, complete` : `Chapter ${chapter.id}`}>{complete ? <FiCheck aria-hidden="true" /> : chapter.id}</span>
                        <div className={styles.chapterContent}><h4>{chapter.title}</h4><p>{chapter.subtitle}</p><div className={styles.chapterTags}>{isNext && <span className={styles.nextBadge}>{inProgress ? 'In progress' : 'Up next'}</span>}<span><FiClock aria-hidden="true" />About {duration(chapter.minutes)} guided study</span><span>{chapter.lessons} lessons · Code · Test</span></div><p className={styles.studyEstimate}>{chapter.studyPlan.readingMinutes} min reading & tracing · {chapter.studyPlan.practiceMinutes} min coding & review</p></div>
                        <FiChevronRight className={styles.rowArrow} aria-hidden="true" />
                      </Link>
                    </li>;
                  })}
                </ol>
              </section>;
            })}
          </div>
          {!visible.length && <div className={styles.noResults}><FiSearch aria-hidden="true" /><h3>No chapters found</h3><p>Try “memory”, “boot”, “files”, or “userspace”.</p><button onClick={() => setQuery('')}>Show all chapters</button></div>}
        </section>

        <aside className={styles.sidebar} aria-label="Your progress and course resources">
          <section className={styles.continueCard} aria-labelledby="continue-title">
            <div className={styles.continueTop}><span>{allComplete ? 'PATH COMPLETED' : started || done ? 'PICK UP WHERE YOU LEFT OFF' : 'YOUR FIRST MILESTONE'}</span><FiArrowRight aria-hidden="true" /></div>
            <div className={styles.progressSummary}><span>Your progress</span><strong>{percentage}<small>%</small></strong></div>
            <progress max={roadmap.length} value={done} aria-label="Course completion" />
            <p className={styles.progressCaption}>{loaded ? `${done} of ${roadmap.length} chapters completed` : 'Loading your saved progress…'}</p>
            <div className={styles.nextLabel}>CHAPTER {next.id} <span>·</span> {next.phase.toUpperCase()}</div>
            <h2 id="continue-title">{next.title}</h2>
            <p className={styles.continueDescription}>{allComplete ? 'Revisit a chapter, refine your implementation, or take your kernel further.' : next.subtitle}</p>
            <Link className={styles.startButton} href={`/learn/os/${next.slug}`}>{allComplete ? 'Revisit the course' : started || done ? 'Continue learning' : 'Start learning'}<FiArrowRight aria-hidden="true" /></Link>
            <div className={styles.savedNote}><span aria-hidden="true" />{storageAvailable ? 'Progress saved on this device' : 'Progress kept for this visit'}</div>
            {!storageAvailable && <p className={styles.storageNotice} role="status">Browser storage is unavailable. Code and progress will not survive a reload.</p>}
          </section>

          <section className={styles.sideCard} aria-labelledby="learn-title">
            <h2 id="learn-title">How a lesson works</h2>
            <ol className={styles.learningLoop}>
              {[
                ['Understand the idea', 'Start with the problem it solves. We introduce the terms and explain how the mechanism works.'],
                ['Follow an example', 'Trace the instructions and explore the diagram. Ask what changes at each step and why.'],
                ['Build it yourself', 'Write a small piece of the program at each coding checkpoint. Open a hint or peek at an answer whenever you need help.'],
                ['Run and submit', 'Use Run to experiment and inspect the result. Submit checks your code and shows which cases passed or need another look.'],
              ].map(([title, description], index) => <li key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}
            </ol>
          </section>

          <section className={styles.sideCard} aria-labelledby="prerequisites-title">
            <h2 id="prerequisites-title">Before you begin</h2>
            <ul className={styles.prerequisites}><li><FiCheck aria-hidden="true" />Start with no assembly experience</li><li><FiCheck aria-hidden="true" />We teach binary, registers, memory, and the stack</li><li><FiCheck aria-hidden="true" />C pointers and a terminal are needed for the kernel stages</li></ul>
            <p className={styles.smallCopy}>The first {roadmap.filter(chapter => chapter.phase === 'x86 Assembly').length} chapters teach x86 assembly from the beginning, through writing your own output routines. You can start in the browser. When we reach the kernel, you’ll use C functions, pointers, and arrays; the bootloading chapter also explains the optional local toolchain.</p>
            <Link className={styles.download} href="/learn/os/assembly-first-instructions"><FiTerminal aria-hidden="true" /><span>Start with your own instructions<small>An empty draft, then one small build at a time</small></span><FiArrowRight aria-hidden="true" /></Link>
          </section>

          <section className={styles.references} aria-labelledby="references-title">
            <h2 id="references-title">Go deeper</h2>
            <p>Use the NASM manual and Intel instruction reference alongside the assembly lessons. The OS books develop the kernel concepts; each chapter links to its relevant sources.</p>
            <ul><li><a href="https://www.nasm.us/doc/nasm03.html">NASM language reference<FiExternalLink aria-hidden="true" /></a></li><li><a href="https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html">Intel instruction-set reference<FiExternalLink aria-hidden="true" /></a></li><li><a href="https://pages.cs.wisc.edu/~remzi/OSTEP/">Operating Systems: Three Easy Pieces<FiExternalLink aria-hidden="true" /></a></li><li><a href="https://www.os-book.com/OS10/">Operating System Concepts<FiExternalLink aria-hidden="true" /></a></li><li><a href="https://wiki.osdev.org/Expanded_Main_Page">OSDev Wiki<FiExternalLink aria-hidden="true" /></a></li><li><a href="https://www.ecsdump.net/wp-content/uploads/2020/12/os-dev.pdf">Nick Blundell’s guide<FiExternalLink aria-hidden="true" /></a></li><li><a href="https://os.phil-opp.com/">Writing an OS in Rust<FiExternalLink aria-hidden="true" /></a></li><li><Link href="/projects/zenos">ZenOS project<FiArrowRight aria-hidden="true" /></Link></li></ul>
          </section>
        </aside>
      </div>
      <footer className={styles.courseNote}><FiCpu aria-hidden="true" /><p>Your first milestone is a program you can explain instruction by instruction. By the end of bootloading, you’ll connect your own files into a bootable C kernel. Later chapters teach one subsystem at a time, with small function exercises before the larger integration work.</p></footer>
    </div>
  </CourseShell>;
}

Course.coursePage = true;
export function getStaticProps() { return { props: { courseTitle, roadmap: chapters.map(chapterSummary), lessonCount: chapters.reduce((count, chapter) => count + chapter.sections.length, 0) } }; }
