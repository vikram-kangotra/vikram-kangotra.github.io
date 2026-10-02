import styles from './lesson-depth.module.css';

export default function ChapterStudyPlan({ plan }) {
  return <section className={styles.studyPlan} aria-label="Suggested study session">
    <h3>Plan your study session</h3>
    <dl><div><dt>Read and trace examples</dt><dd>About {plan.readingMinutes} min</dd></div><div><dt>Code, debug, and review</dt><dd>About {plan.practiceMinutes} min</dd></div></dl>
    <p>These are planning estimates, including time to trace the diagrams and work through examples. Pause and experiment as you go. Building these ideas into your own full kernel can take additional sessions.</p>
  </section>;
}
