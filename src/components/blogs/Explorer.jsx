import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dayjs from 'dayjs';
import { topicsFor } from '@/constants/topics';
import { SaveButton, useReading } from '@/context/ReadingContext';
import { Arrow } from '@/components/ui';
const topicOptions = [
  'All topics',
  'Rust',
  'WebAssembly',
  'VideoLAN',
  'GSoC',
  'Open source',
  'GNOME',
  'GTK',
];
export default function Explorer({ blogs }) {
  const router = useRouter();
  const { saved, ready } = useReading();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All topics');
  const [view, setView] = useState('all');
  const [sort, setSort] = useState('newest');
  const [layout, setLayout] = useState('list');
  const input = useRef(null);
  const syncTarget = useRef(null);
  useEffect(() => {
    if (router.isReady) {
      const incoming = JSON.stringify([
        router.query.q || '',
        router.query.topic || 'All topics',
        router.query.view || 'all',
      ]);
      if (syncTarget.current && syncTarget.current !== incoming) return;
      syncTarget.current = null;
      setQuery(typeof router.query.q === 'string' ? router.query.q : '');
      setTopic(topicOptions.includes(router.query.topic) ? router.query.topic : 'All topics');
      setView(router.query.view === 'saved' ? 'saved' : 'all');
    }
  }, [router.isReady, router.query.q, router.query.topic, router.query.view]);
  function update(values) {
    const params = { ...router.query };
    Object.entries({ q: query, topic, view, ...values }).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== 'All topics') params[key] = value;
      else delete params[key];
    });
    syncTarget.current = JSON.stringify([
      params.q || '',
      params.topic || 'All topics',
      params.view || 'all',
    ]);
    router.replace({ pathname: router.pathname, query: params }, undefined, {
      shallow: true,
      scroll: false,
    });
  }
  const filtered = blogs
    .filter(
      (blog) =>
        (view !== 'saved' || saved.includes(blog.slug)) &&
        (topic === 'All topics' || topicsFor(blog.slug).includes(topic)) &&
        `${blog.title} ${blog.excerpt} ${topicsFor(blog.slug).join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
    )
    .sort((a, b) =>
      sort === 'oldest'
        ? a.publishedAt.localeCompare(b.publishedAt)
        : sort === 'shortest'
          ? parseFloat(a.readingTime) - parseFloat(b.readingTime)
          : b.publishedAt.localeCompare(a.publishedAt)
    );
  function reset() {
    setQuery('');
    setTopic('All topics');
    setView('all');
    update({ q: '', topic: '', view: '' });
    input.current?.focus();
  }
  return (
    <section className="explorer" id="stories" aria-label="Explore articles">
      <div className="explorer-tabs">
        <div className="collection-tabs" aria-label="Article collection">
          <button
            aria-pressed={view === 'all'}
            onClick={() => {
              setView('all');
              update({ view: 'all' });
            }}
          >
            All writing <span>{blogs.length}</span>
          </button>
          <button
            aria-pressed={view === 'saved'}
            onClick={() => {
              setView('saved');
              update({ view: 'saved' });
            }}
          >
            Reading list{' '}
            <span>
              {ready ? saved.filter((slug) => blogs.some((b) => b.slug === slug)).length : 0}
            </span>
          </button>
        </div>
        <div className="layout-controls" aria-label="Article layout">
          <button
            aria-pressed={layout === 'list'}
            aria-label="List layout"
            onClick={() => setLayout('list')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            aria-pressed={layout === 'grid'}
            aria-label="Grid layout"
            onClick={() => setLayout('grid')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="explorer-tools">
        <div className="explorer-search">
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          <label htmlFor="article-search" className="sr-only">
            Search articles
          </label>
          <input
            ref={input}
            id="article-search"
            type="search"
            value={query}
            placeholder="Find a story, a topic, a rabbit hole…"
            onChange={(e) => {
              setQuery(e.target.value);
              update({ q: e.target.value });
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                update({ q: '' });
                input.current?.focus();
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <label className="sort-control">
          <span className="sr-only">Sort articles</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="shortest">Shortest read</option>
          </select>
        </label>
      </div>
      <div className="topic-filters" aria-label="Filter by topic">
        {topicOptions.map((value) => (
          <button
            key={value}
            aria-pressed={topic === value}
            onClick={() => {
              setTopic(value);
              update({ topic: value });
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="results-caption">
        <span role="status">
          {view === 'saved' && !ready
            ? 'Loading your reading list…'
            : `${filtered.length} ${filtered.length === 1 ? 'story' : 'stories'}${topic !== 'All topics' ? ` about ${topic}` : ''}`}
        </span>
        <span>{view === 'saved' ? 'Saved on this browser' : 'A notebook, not a news feed.'}</span>
      </div>
      <div className={`story-collection ${layout === 'grid' ? 'story-grid' : ''}`}>
        {filtered.map((blog, index) => (
          <article key={blog.slug} className="story-card">
            <div className="story-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="story-main">
              <div className="story-meta">
                <time dateTime={blog.publishedAt}>
                  {dayjs(blog.publishedAt).format('MMM D, YYYY')}
                </time>
                <span>·</span>
                <span>{blog.readingTime}</span>
              </div>
              <Link href={`/blogs/${blog.slug}`} className="story-title">
                <h3>{blog.title}</h3>
                <Arrow diagonal />
              </Link>
              <p>{blog.excerpt}</p>
              <div className="story-tags">
                {topicsFor(blog.slug).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setTopic(tag);
                      update({ topic: tag });
                    }}
                    aria-label={`Filter by ${tag}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <SaveButton slug={blog.slug} title={blog.title} />
          </article>
        ))}
      </div>
      {filtered.length === 0 && (ready || view !== 'saved') && (
        <div className="empty-state">
          <span className="empty-symbol" aria-hidden="true">
            {view === 'saved' ? '[ ]' : '?'}
          </span>
          <h3>
            {view === 'saved' && !query && topic === 'All topics'
              ? 'Your next read belongs here.'
              : 'No stories found.'}
          </h3>
          <p>
            {view === 'saved' && !query && topic === 'All topics'
              ? 'Bookmark a story to keep it here for later. Your list stays in this browser.'
              : 'Try a different topic or search term.'}
          </p>
          <button className="button button-primary" onClick={reset}>
            {view === 'saved' ? 'Explore all stories' : 'Reset filters'}
          </button>
        </div>
      )}
    </section>
  );
}
