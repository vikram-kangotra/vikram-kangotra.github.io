import { useState } from 'react';
import Link from 'next/link';
import { chapters } from '@/course';
import { SEO } from '@/components/ui';
import CourseShell from '@/components/course/CourseShell';
import DetailedGuide, { TopicExercises } from '@/components/course/DetailedGuide';
import styles from '@/components/course/topic-reference.module.css';

export default function Topic({ topic, chapter, section }) {
  const [practice, setPractice] = useState(false);
  function select(value) { setPractice(value); requestAnimationFrame(() => document.getElementById('topic-view-title')?.focus()); }
  return <CourseShell context="OS TOPIC REFERENCE"><SEO title={`${topic.title}: Vikram Kangotra`} description={topic.intro[0].replace(/`/g, '').slice(0, 160)} path={`/learn/os/reference/${topic.id}`} /><div className={styles.page}>
    <nav aria-label="Breadcrumb"><Link href="/learn/os">OS course</Link><span> / </span><Link href="/learn/os/reference">Topic reference</Link></nav>
    <header><p className={styles.eyebrow}>{chapter.title}</p><h1>{topic.title}</h1><p><Link href={`/learn/os/${chapter.slug}#lesson-${section.id}`}>Read in the supporting lesson: {section.title}</Link></p></header>
    <div className={styles.viewSwitch} role="group" aria-label="Topic view"><button type="button" aria-pressed={!practice} onClick={() => select(false)}>Explanation</button><button type="button" aria-pressed={practice} onClick={() => select(true)}>Problems and solutions</button></div>
    <h2 id="topic-view-title" tabIndex={-1}>{practice ? 'Problems and solutions' : 'Explanation and worked traces'}</h2>
    {practice ? <TopicExercises topics={[topic]} /> : <DetailedGuide topics={[topic]} onPractice={() => select(true)} />}
    <footer><Link href="/learn/os/reference">Browse all topics</Link><Link href="/learn/os/playground">Open the x86 playground</Link></footer>
  </div></CourseShell>;
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
