import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dayjs from 'dayjs';
import rehypeCodeTitles from 'rehype-code-titles';
import rehypePrism from 'rehype-prism-plus';
import rehypeSlug from 'rehype-slug';
import { getBlogFromSlug, getSlug } from '@/utils/mdx';
import { serialize } from 'next-mdx-remote/serialize';
import { MDXRemote } from 'next-mdx-remote';
import CustomLink from '@/components/customlink';
import { SEO, Eyebrow, Arrow } from '@/components/ui';
import { SaveButton } from '@/context/ReadingContext';
import { topicsFor } from '@/constants/topics';
import { articleImages } from '@/constants/siteImages';
function ArticleImage({ alt, ...props }) {
  const imageProps = { ...props };
  delete imageProps.layout;
  const responsive = articleImages[props.src];
  if (responsive) {
    return (
      // Static export uses pre-generated image sizes instead of an image server.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...imageProps}
        src={responsive.src}
        srcSet={responsive.srcSet}
        width={imageProps.width || responsive.width}
        height={imageProps.height || responsive.height}
        sizes={`${Number(imageProps.width) || 300}px`}
        alt={alt || responsive.alt}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <Image
      {...imageProps}
      alt={alt || 'Illustration accompanying the article'}
      sizes="(max-width: 760px) 90vw, 720px"
    />
  );
}
function CodeBlock(props) {
  const code = useRef(null);
  const timer = useRef(null);
  const [label, setLabel] = useState('Copy');
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code.current.innerText);
      setLabel('Copied!');
    } catch {
      window.getSelection()?.selectAllChildren(code.current);
      setLabel('Code selected');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel('Copy'), 2200);
  }
  return (
    <div className="reader-code">
      <button className="copy-code" onClick={copy} title="Copy code block">
        <span role="status">{label}</span>
      </button>
      <pre ref={code} tabIndex={0} {...props} />
    </div>
  );
}
export default function Blog(props) {
  return <Reader key={props.post.frontmatter.slug} {...props} />;
}
function Reader({ post: { source, frontmatter }, previous, next, allBlogs, initialToc = [] }) {
  const article = useRef(null);
  const toc = initialToc;
  const [active, setActive] = useState('');
  const [progress, setProgress] = useState(0);
  const [focus, setFocus] = useState(false);
  const [size, setSize] = useState('normal');
  const [shareLabel, setShareLabel] = useState('Copy link');
  const shareTimer = useRef(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vk-reading-size');
      if (['normal', 'large', 'larger'].includes(stored)) setSize(stored);
    } catch {
      /* Defaults remain usable without storage. */
    }
    return () => clearTimeout(shareTimer.current);
  }, []);
  useEffect(() => {
    const headings = Array.from(article.current.querySelectorAll('h2[id],h3[id]'));
    let frame = null;
    const update = () => {
      frame = null;
      const rect = article.current.getBoundingClientRect();
      const available = Math.max(1, rect.height - window.innerHeight + 150);
      setProgress(Math.round(Math.max(0, Math.min(100, ((150 - rect.top) / available) * 100))));
      let current = headings[0]?.id || '';
      headings.forEach((h) => {
        if (h.getBoundingClientRect().top <= 190) current = h.id;
      });
      setActive(current);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(article.current);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  function changeSize(value) {
    setSize(value);
    try {
      localStorage.setItem('vk-reading-size', value);
    } catch {
      /* Keep the selection for this visit. */
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Link copied');
    } catch {
      setShareLabel('Copy the URL from your address bar');
    }
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareLabel('Copy link'), 3000);
  }
  const links = (
    <ol>
      {toc.map((item) => (
        <li key={item.id} className={item.level === 3 ? 'toc-sub' : ''}>
          <a
            href={`#${item.id}`}
            aria-current={active === item.id ? 'location' : undefined}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.currentTarget.closest('details')?.removeAttribute('open');
              const heading = document.getElementById(item.id);
              if (heading) {
                heading.tabIndex = -1;
                requestAnimationFrame(() => heading.focus({ preventScroll: true }));
              }
            }}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <div className={`shell article-page reader-page ${focus ? 'focus-reading' : ''}`}>
      <div
        className="reading-progress"
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden="true"
      />
      <SEO
        title={`${frontmatter.title}: Vikram Kangotra`}
        description={frontmatter.excerpt}
        path={`/blogs/${frontmatter.slug}`}
        type="article"
        publishedAt={frontmatter.publishedAt}
      />
      <Link className="back-link" href="/blogs">
        ← Back to the notebook
      </Link>
      <header className="article-header">
        <div className="article-topic-links">
          {topicsFor(frontmatter.slug).map((topic) => (
            <Link href={{ pathname: '/blogs', query: { topic } }} key={topic}>
              {topic}
            </Link>
          ))}
        </div>
        <h1>{frontmatter.title}</h1>
        <div className="article-meta">
          <span>By Vikram Kangotra</span>
          <span aria-hidden="true">·</span>
          <time dateTime={frontmatter.publishedAt}>
            {dayjs(frontmatter.publishedAt).format('MMMM D, YYYY')}
          </time>
          <span aria-hidden="true">·</span>
          <span>{frontmatter.readingTime}</span>
        </div>
      </header>
      <div className="reader-toolbar" aria-label="Reading controls">
        <div className="font-controls" role="group" aria-label="Reading text size">
          {[
            ['normal', 'A', 'Standard text'],
            ['large', 'A', 'Large text'],
            ['larger', 'A', 'Extra large text'],
          ].map(([value, label, title], index) => (
            <button
              key={value}
              className={`font-size-${index}`}
              aria-label={`${label}: ${title}`}
              aria-pressed={size === value}
              onClick={() => changeSize(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="focus-toggle" aria-pressed={focus} onClick={() => setFocus(!focus)}>
          <span aria-hidden="true">{focus ? '↔' : '⌖'}</span>
          {focus ? 'Exit focus' : 'Focus mode'}
        </button>
        <div className="reader-actions">
          <SaveButton slug={frontmatter.slug} title={frontmatter.title} withLabel />
          <button className="share-button" title="Copy article link" onClick={share}>
            <span role="status">{shareLabel}</span>
            <Arrow diagonal />
          </button>
        </div>
      </div>
      {toc.length > 0 && (
        <details className="mobile-toc">
          <summary>
            In this article <span>{progress}% read</span>
          </summary>
          {links}
        </details>
      )}
      <div className="article-layout">
        <article ref={article} className={`article-body prose reading-size-${size}`}>
          <MDXRemote
            {...source}
            components={{ Image: ArticleImage, a: CustomLink, pre: CodeBlock }}
          />
        </article>
        <aside className="article-aside">
          <div className="toc-heading">
            <Eyebrow>{toc.length ? 'IN THIS ARTICLE' : 'A SHORT READ'}</Eyebrow>
            <span>{progress}%</span>
          </div>
          {toc.length > 0 ? (
            <nav className="desktop-toc" aria-label="Table of contents">
              {links}
            </nav>
          ) : (
            <p>A small detour from the notebook. Settle in.</p>
          )}
          <div className="aside-stories">
            <Eyebrow>ANOTHER RABBIT HOLE</Eyebrow>
            {allBlogs
              .filter((b) => b.slug !== frontmatter.slug)
              .slice(0, 2)
              .map((blog) => (
                <Link href={`/blogs/${blog.slug}`} key={blog.slug}>
                  {blog.title}
                  <Arrow />
                </Link>
              ))}
          </div>
        </aside>
      </div>
      <section className="reader-end">
        <Eyebrow>THANKS FOR READING</Eyebrow>
        <h2>Have a thought on this?</h2>
        <p>I’d love to hear what you’re building or what you’d do differently.</p>
        <a
          className="text-link"
          href={`mailto:vikramkangotra8055@gmail.com?subject=${encodeURIComponent(frontmatter.title)}`}
        >
          Start a conversation <Arrow diagonal />
        </a>
      </section>
      <nav className="article-pagination" aria-label="More stories">
        {[
          { slug: previous, label: 'OLDER STORY' },
          { slug: next, label: 'NEWER STORY' },
        ]
          .filter((item) => item.slug)
          .map((item) => (
            <Link key={item.slug} href={`/blogs/${item.slug}`}>
              <Eyebrow>{item.label}</Eyebrow>
              <h2>{allBlogs.find((b) => b.slug === item.slug)?.title}</h2>
              <Arrow />
            </Link>
          ))}
      </nav>
    </div>
  );
}
export async function getStaticPaths() {
  const paths = (await getSlug()).map((slug) => ({ params: { slug } }));

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const { slug } = params;
  const { content, frontmatter } = await getBlogFromSlug(slug);
  const initialToc = [];
  function collectHeadings() {
    return (tree) => {
      const text = (node) =>
        node.type === 'text' ? node.value : (node.children || []).map(text).join('');
      function visit(node) {
        if (
          node.type === 'element' &&
          (node.tagName === 'h2' || node.tagName === 'h3') &&
          node.properties?.id
        ) {
          initialToc.push({
            id: String(node.properties.id),
            text: text(node),
            level: node.tagName === 'h2' ? 2 : 3,
          });
        }
        (node.children || []).forEach(visit);
      }
      visit(tree);
    };
  }

  const mdxSource = await serialize(content, {
    mdxOptions: {
      rehypePlugins: [rehypeSlug, collectHeadings, rehypePrism, rehypeCodeTitles],
    },
  });

  // Get all blogs data first
  let allBlogs = [];
  try {
    const paths = await getSlug();
    allBlogs = await Promise.all(
      paths.map(async (blogSlug) => {
        const { frontmatter: blogFrontmatter } = await getBlogFromSlug(blogSlug);
        return {
          slug: blogSlug,
          title: blogFrontmatter.title,
          publishedAt: blogFrontmatter.publishedAt,
          excerpt: blogFrontmatter.excerpt,
          readingTime: blogFrontmatter.readingTime,
        };
      })
    );

    // Sort blogs by date (newest first)
    allBlogs.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Find the current blog's index in the sorted array
    const currentIndex = allBlogs.findIndex((blog) => blog.slug === slug);

    // Since we're sorting newest first, the logic needs to be reversed:
    // Next is the newer post (index - 1)
    const next = currentIndex > 0 ? allBlogs[currentIndex - 1].slug : null;
    // Previous is the older post (index + 1)
    const previous = currentIndex < allBlogs.length - 1 ? allBlogs[currentIndex + 1].slug : null;

    return {
      props: {
        post: {
          source: mdxSource,
          frontmatter,
        },
        previous,
        next,
        allBlogs,
        initialToc,
      },
    };
  } catch (error) {
    console.error('Error fetching blog data:', error);
    return {
      props: {
        post: {
          source: mdxSource,
          frontmatter,
        },
        previous: null,
        next: null,
        allBlogs: [],
        initialToc,
      },
    };
  }
}
