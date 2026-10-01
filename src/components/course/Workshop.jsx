import { useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import CodeBlock from './CodeBlock';
import CodeEditor from './CodeEditor';
import styles from './exercise-workshop.module.css';

function assemblyReference(source) {
  const startMarker = '; --- Your lesson program starts here ---\nlesson:\n';
  const endMarker = '; --- End of lesson program ---';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) return null;
  const body = source.slice(start + startMarker.length, end).trimEnd().replace(/\n[ \t]*ret[ \t]*$/, '').trimEnd();
  const helpers = source.slice(end + endMarker.length);
  const data = helpers.match(/\nputs:\s*\n[\s\S]*?\n[ \t]+ret[ \t]*\n\n([\s\S]*?)\ntimes 510-\(\$-\$\$\) db 0/);
  return { body, data: data?.[1]?.trim() || '' };
}

export default function Workshop({ chapter, state, update, unlocked = false, onOpenAssembly, onContinueReading }) {
  const [hint, setHint] = useState(0);
  const [solution, setSolution] = useState(false);
  const challenge = chapter.challenge;
  const sharedWorkspace = Boolean(chapter.guide || chapter.assembly);
  const code = typeof state.code === 'string' ? state.code : challenge.starter;
  const checked = Array.isArray(state.checks) ? state.checks : [];
  const canCompareSolution = unlocked;
  const referenceVisible = solution && canCompareSolution;
  const reference = chapter.guide?.kind === 'assembly' ? chapter.guide.steps[chapter.guide.steps.length - 1].reference : chapter.assembly ? assemblyReference(challenge.solution) : null;
  const filename = `${chapter.slug}-exercise.${challenge.language === 'asm' ? 'asm' : 'c'}`;
  function toggle(key, list, index) {
    update({ [key]: list.includes(index) ? list.filter((x) => x !== index) : [...list, index], complete: false });
  }
  function download() {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
  }
  if (!unlocked) return <section id="workshop" tabIndex={-1} className={styles.workshop} aria-labelledby="exercise-heading">
    <div className={styles.metadata}><span>CHAPTER CHECKPOINT</span><span className={styles.badge}>After the lesson steps</span></div>
    <h2 id="exercise-heading">{challenge.title}</h2>
    <p className={styles.brief}>{challenge.brief}</p>
    <p className={styles.note}>Build your understanding one section at a time. Finish the lesson steps to open this chapter’s exercise and test checklist. Your saved work stays here.</p>
    <div className={styles.actions}><button type="button" className={styles.hintButton} disabled={!onContinueReading} onClick={onContinueReading}>Return to lesson</button></div>
  </section>;
  return <>
    <section id="workshop" tabIndex={-1} className={styles.workshop} aria-labelledby="exercise-heading">
      <div className={styles.metadata}><span>CHAPTER CHECKPOINT</span><span className={styles.badge}>{sharedWorkspace ? 'Browser workspace' : 'Native toolchain'}</span></div>
      <h2 id="exercise-heading">{challenge.title}</h2>
      <p className={styles.brief}>{challenge.brief}</p>
      <ol className={styles.tasks}>{challenge.tasks.map((task) => <li key={task}>{task}</li>)}</ol>
      {sharedWorkspace ? <div className={styles.actions}><button type="button" className={styles.hintButton} onClick={onOpenAssembly}>Open Workspace</button></div> : <div className={styles.implementation}>
        <div className={styles.editorHeader}><span><strong>Your implementation</strong><small>{challenge.language === 'asm' ? 'Assembly' : challenge.language.toUpperCase()}</small></span><button type="button" onClick={download}><FiDownload aria-hidden="true" />Download source</button></div>
        <CodeEditor id="exercise-code" label="Your implementation" language={challenge.language} value={code} onChange={(value) => update({ code: value, checks: [], complete: false })} />
      </div>}
      <p id="execution-note" className={styles.executionNote}>{chapter.guide?.steps?.[0]?.tests?.kind === 'c-function' ? 'Start with the small function exercise in Workspace. Run tries one sample; Submit checks every case. Once it passes, try the larger kernel experiments described here. Use Run kernel project in Build when your complete project is ready, then use the checklist below to track the cases you tried.' : chapter.guide ? 'Continue the final coding checkpoint in Workspace. Run lets you inspect its output; Submit builds, runs, and checks your code. Use the checklist below to track your extra experiments.' : chapter.assembly ? 'Finish your chapter program in Workspace. Build and run it, inspect the machine output, and choose Check this run. Then tick the cases you tried below.' : 'Compile and test this exercise with the chapter’s native toolchain. Use the list below to keep track of the cases you tried. You can also open Workspace to build an assembly or C project, or load a disk image.'}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.hintButton} disabled={hint >= challenge.hints.length} onClick={() => setHint(hint + 1)} aria-controls="exercise-hints">Reveal hint {Math.min(hint + 1, challenge.hints.length)} / {challenge.hints.length}</button>
        {canCompareSolution && <button type="button" className={styles.textButton} onClick={() => setSolution(!solution)} aria-expanded={referenceVisible} aria-controls="exercise-solution">{referenceVisible ? 'Hide answer' : 'Peek at answer'}</button>}
      </div>
      <p className={styles.note}>Hints and answers are here whenever you need them. Opening an answer does not change your files or mark the exercise complete.</p>
      <div id="exercise-hints" aria-live="polite">{hint > 0 && <ol className={styles.hints}>{challenge.hints.slice(0, hint).map((text) => <li key={text}>{text}</li>)}</ol>}</div>
      <div id="exercise-solution" hidden={!referenceVisible} className={styles.solution}>{referenceVisible && <>
        {chapter.assembly ? reference && <><CodeBlock code={{ language: 'asm', filename: 'lesson.asm: one possible lesson body', source: reference.body }} />{reference.data && <CodeBlock code={{ language: 'asm', filename: 'data.inc: lesson data', source: reference.data }} />}</> : <CodeBlock code={{ language: challenge.language, filename: 'One possible implementation', source: challenge.solution }} />}
        <p>{challenge.explanation}</p><p className={styles.note}>Follow the example one step at a time. Explain why each step is needed, then use that reasoning to improve your own code.</p>
      </>}</div>
      <fieldset className={styles.checklist}><legend>Try these cases</legend><p>Run each case and inspect the result. Tick it after you have tried it and can explain what happened. Editing your implementation clears this list so you can check the new version.</p>{challenge.checks.map((text, i) => <label key={text}><input type="checkbox" checked={checked.includes(i)} onChange={() => toggle('checks', checked, i)} /><span>{text}</span></label>)}</fieldset>
    </section>
  </>;
}
