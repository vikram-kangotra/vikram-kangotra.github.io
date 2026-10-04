import { useState } from 'react';
import Link from 'next/link';
import { chapters } from '@/course';
import { SEO } from '@/components/ui';
import CourseShell from '@/components/course/CourseShell';
import DetailedGuide, { TopicExercises } from '@/components/course/DetailedGuide';
import styles from '@/components/course/topic-reference.module.css';

function Inline({ text }) {
  return String(text).split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part);
}

export default function Topic({ topic, chapter, section }) {
  const [practice, setPractice] = useState(false);
  const hasPractice = topic.blocks.some(block => block.type === 'exercise');
  const outline = topic.blocks.flatMap((block, index) => block.type !== 'exercise' && (block.title || block.caption) ? [{ id: `topic-${topic.id}-block-${index}`, title: block.title || block.caption }] : []);
  function select(value) {
    setPractice(value);
    requestAnimationFrame(() => {
      const heading = document.getElementById(value ? 'topic-practice-title' : 'topic-explanation-title');
      heading?.scrollIntoView({ block: 'start' });
      heading?.focus({ preventScroll: true });
    });
  }
  function followAnchor(event, id) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setPractice(false);
    requestAnimationFrame(() => { const target = document.getElementById(id); target?.scrollIntoView({ block: 'start' }); target?.focus({ preventScroll: true }); });
  }
  const lessonHref = `/learn/os/${chapter.slug}#lesson-${section.id}`;
  return <CourseShell context="Topic reference">
    <SEO title={`${topic.title}: Vikram Kangotra`} description={topic.intro[0].replace(/`/g, '').slice(0, 160)} path={`/learn/os/reference/${topic.id}`} />
    <div className={`${styles.page} ${styles.detailPage}`}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><ol><li><Link prefetch={false} href="/learn/os">OS course</Link></li><li><Link prefetch={false} href="/learn/os/reference">Topic reference</Link></li><li><Link prefetch={false} href={`/learn/os/${chapter.slug}`}>{chapter.title}</Link></li></ol></nav>
      <header className={styles.topicHeader}><p className={styles.eyebrow}>Topic reference</p><h1>{topic.title}</h1><p className={styles.lessonLink}>In the course: <Link prefetch={false} href={lessonHref}>{section.title}</Link></p></header>
      <div className={styles.topicLayout}>
        <aside className={styles.topicRail}>
          <nav aria-label="On this page"><h2>On this page</h2><ol><li><a href="#topic-explanation-title" onClick={event => followAnchor(event, 'topic-explanation-title')}>Overview</a></li>{outline.map(item => <li key={item.id}><a href={`#${item.id}`} onClick={event => followAnchor(event, item.id)}>{item.title}</a></li>)}</ol></nav>
          <div className={styles.railLinks}><Link prefetch={false} href="/learn/os/reference">All topics</Link><Link prefetch={false} href={lessonHref}>Read the course lesson</Link></div>
        </aside>
        <article className={styles.topicBody}>
          {hasPractice && <div className={styles.viewSwitch} role="group" aria-label="Topic view"><button type="button" aria-pressed={!practice} onClick={() => select(false)}>Explanation</button><button type="button" aria-pressed={practice} onClick={() => select(true)}>Problems and solutions</button></div>}
          <section hidden={practice} aria-labelledby="topic-explanation-title">
            <h2 id="topic-explanation-title" className={styles.readingHeading} tabIndex={-1}>Overview</h2>
            <div className={styles.topicIntroduction}>{topic.intro.map((paragraph, index) => <p key={index}><Inline text={paragraph} /></p>)}</div>
            <DetailedGuide topics={[topic]} lessonTopic hideHeading onPractice={hasPractice ? () => select(true) : undefined} />
          </section>
          {hasPractice && <section hidden={!practice} aria-labelledby="topic-practice-title"><h2 id="topic-practice-title" className={styles.readingHeading} tabIndex={-1}>Problems and solutions</h2><TopicExercises topics={[topic]} /></section>}
          <footer className={styles.topicFooter}><Link prefetch={false} href="/learn/os/reference">Back to all topics</Link><Link prefetch={false} href={lessonHref}>Continue in the course lesson</Link></footer>
        </article>
      </div>
    </div>
  </CourseShell>;
}
Topic.coursePage = true;
export function getStaticPaths() { return { paths: chapters.flatMap(chapter => chapter.sections.flatMap(section => (section.topics || []).map(topic => ({ params: { topic: topic.id } })))), fallback: false }; }
export function getStaticProps({ params }) {
  for (const chapter of chapters) for (const section of chapter.sections) {
    const topic = section.topics?.find(item => item.id === params.topic);
    if (topic) return { props: { topic, chapter: { title: chapter.title, slug: chapter.slug }, section: { id: section.id, title: section.title } } };
  }
  return { notFound: true };
}
