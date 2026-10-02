/* global Set */
import { useState } from 'react';
import Link from 'next/link';
import { SEO } from '@/components/ui';
import CourseShell from '@/components/course/CourseShell';
import { chapters } from '@/course';
import styles from '@/components/course/topic-reference.module.css';

export default function Reference({ topics }) {
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState('');
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = topics.filter(topic => (!chapter || topic.chapter === chapter) && words.every(word => topic.search.includes(word)));
  const chapterNames = [...new Set(topics.map(topic => topic.chapter))];
  return <CourseShell context="OS TOPIC REFERENCE"><SEO title="Operating systems topic reference: Vikram Kangotra" description="Detailed OS mechanisms, descriptor and page-table layouts, allocation and scheduling algorithms, worked execution traces, and practice exercises." path="/learn/os/reference" /><div className={styles.page}>
    <nav aria-label="Breadcrumb"><Link href="/learn/os">OS course</Link><span> / Topic reference</span></nav>
    <header><p className={styles.eyebrow}>MECHANISMS AND ALGORITHMS</p><h1>Look inside the operating system.</h1><p>Find the exact table, algorithm, CPU transition, or execution trace you need. Each topic includes its assumptions, worked examples, failure cases, and further practice. Topics are also part of the supporting course lessons.</p><p>Coverage follows <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/">Operating Systems: Three Easy Pieces</a> and <a href="https://www.os-book.com/OS10/">Operating System Concepts, tenth edition</a>. The explanations, diagrams, code, and exercises here are original. Architecture topics link to the relevant hardware documentation.</p></header>
    <div className={styles.filters}><label>Find a concept<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="GDT, IDT, buddy, page fault, deadlock…" /></label><label>Chapter<select value={chapter} onChange={event => setChapter(event.target.value)}><option value="">All chapters</option>{chapterNames.map(name => <option key={name}>{name}</option>)}</select></label></div>
    <p role="status">{visible.length} of {topics.length} detailed topics</p>
    <ul className={styles.results}>{visible.map(topic => <li key={topic.id}><span>{topic.chapter}</span><h2><Link href={`/learn/os/reference/${topic.id}`}>{topic.title}</Link></h2><p>{topic.intro.replace(/`/g, '')}</p><small>{topic.diagrams} {topic.diagrams === 1 ? 'diagram or table' : 'diagrams and tables'} · {topic.exercises} {topic.exercises === 1 ? 'exercise' : 'exercises'}</small></li>)}</ul>
    {!visible.length && <p>Try a shorter term or choose all chapters.</p>}
  </div></CourseShell>;
}
Reference.coursePage = true;
export function getStaticProps() {
  const topics = chapters.flatMap(chapter => chapter.sections.flatMap(section => (section.topics || []).map(topic => ({ id: topic.id, title: topic.title, chapter: chapter.title, intro: topic.intro[0], diagrams: topic.blocks.filter(block => ['bits', 'flow', 'table', 'trace'].includes(block.type)).length, exercises: topic.blocks.filter(block => block.type === 'exercise').length, search: [...new Set(`${chapter.title} ${topic.id} ${topic.title} ${topic.intro.join(' ')} ${JSON.stringify(topic.blocks)}`.toLowerCase().match(/[a-z0-9]+(?:[-_.][a-z0-9]+)*/g) || [])].join(' ') }))));
  return { props: { topics } };
}
