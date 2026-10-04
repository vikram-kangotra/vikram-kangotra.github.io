import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { SEO } from '@/components/ui';
import CourseShell from '@/components/course/CourseShell';
import { chapters } from '@/course';
import { buildTopicCatalog, getTopicCollections, searchTopics } from '@/course/topicCatalog';
import styles from '@/components/course/topic-reference.module.css';

export default function Reference({ topics, collections }) {
  const router = useRouter();
  const query = router.isReady && typeof router.query.q === 'string' ? router.query.q.trim() : '';
  const [draft, setDraft] = useState('');
  useEffect(() => { setDraft(query); }, [query]);
  const results = searchTopics(topics, query);
  const groups = topics.reduce((all, topic) => {
    let group = all.find(item => item.slug === topic.chapterSlug);
    if (!group) { group = { slug: topic.chapterSlug, title: topic.chapterTitle, topics: [] }; all.push(group); }
    group.topics.push(topic);
    return all;
  }, []);
  function search(event) {
    event.preventDefault();
    const q = draft.trim();
    router.push({ pathname: '/learn/os/reference', query: q ? { q } : {} }, undefined, { shallow: true, scroll: false });
  }
  function clear(event) {
    event.preventDefault();
    setDraft('');
    router.push('/learn/os/reference', undefined, { shallow: true, scroll: false });
  }
  return <CourseShell context="Topic reference">
    <SEO title="Operating systems topic reference: Vikram Kangotra" description="Find OS mechanisms, descriptor tables, paging, memory allocation, scheduling, and worked examples by subject." path="/learn/os/reference" />
    <div className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><ol><li><Link prefetch={false} href="/learn/os">OS course</Link></li><li aria-current="page">Topic reference</li></ol></nav>
      <header className={styles.indexHeader}>
        <h1>Topic reference</h1>
        <p className={styles.lead}>Explanations, layouts, and worked examples from the course. Browse a subject or look up a specific mechanism.</p>
      </header>
      <form className={styles.search} role="search" aria-label="Topic reference" onSubmit={search}>
        <label htmlFor="reference-query">Search topics</label>
        <div className={styles.searchRow}><input id="reference-query" name="q" type="search" value={draft} onChange={event => setDraft(event.target.value)} placeholder="GDT, IDT, page faults, buddy allocator" /><button type="submit">Search</button></div>
      </form>
      {query ? <section className={styles.searchResults} aria-labelledby="results-title">
        <div className={styles.sectionHeading}><h2 id="results-title">Search results</h2><Link prefetch={false} href="/learn/os/reference" onClick={clear}>Browse all topics</Link></div>
        <p className={styles.resultCount} role="status">{results.length} {results.length === 1 ? 'topic' : 'topics'} for “{query}”</p>
        <ul className={styles.results}>{results.map(topic => <li key={topic.id}>
          <p className={styles.resultChapter}><Link prefetch={false} href={`/learn/os/${topic.chapterSlug}`}>{topic.chapterTitle}</Link></p>
          <h3><Link prefetch={false} href={topic.href}>{topic.title}</Link></h3>
          <p>{topic.summary}</p>
        </li>)}</ul>
        {!results.length && <p>Try a broader term, such as “interrupt”, “paging”, or “allocation”. You can also <Link prefetch={false} href="/learn/os/reference" onClick={clear}>browse the subject directory</Link>.</p>}
      </section> : <>
        <section className={styles.subjects} aria-labelledby="subjects-title">
          <div className={styles.sectionHeading}><h2 id="subjects-title">Browse by subject</h2><a href="#all-topics">All {topics.length} topics</a></div>
          <div className={styles.subjectGrid}>{collections.map(group => <section key={group.id} aria-labelledby={`subject-${group.id}`}>
            <h3 id={`subject-${group.id}`}>{group.title}</h3><p>{group.description}</p>
            <ul>{group.topics.map(topic => <li key={topic.href}><Link prefetch={false} href={topic.href}>{topic.label}</Link></li>)}</ul>
          </section>)}</div>
        </section>
        <section className={styles.directory} aria-labelledby="all-topics">
          <div className={styles.sectionHeading}><h2 id="all-topics" tabIndex={-1}>All topics</h2><span>{topics.length} topics, grouped by chapter</span></div>
          {groups.map(group => <section className={styles.chapterGroup} key={group.slug} aria-labelledby={`chapter-${group.slug}`}>
            <h3 id={`chapter-${group.slug}`}><Link prefetch={false} href={`/learn/os/${group.slug}`}>{group.title}</Link></h3>
            <ul className={styles.directoryTopics}>{group.topics.map(topic => <li key={topic.id}><Link prefetch={false} href={topic.href}>{topic.title}</Link></li>)}</ul>
          </section>)}
        </section>
      </>}
      <footer className={styles.indexFooter}><p>The reference is part of <Link prefetch={false} href="/learn/os">Building an OS from Scratch</Link>. Each topic links back to its course lesson and cites the relevant sources.</p></footer>
    </div>
  </CourseShell>;
}
Reference.coursePage = true;
export function getStaticProps() {
  const catalog = buildTopicCatalog(chapters);
  return { props: { topics: catalog.filter(item => item.kind === 'topic'), collections: getTopicCollections(catalog) } };
}
