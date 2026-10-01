import Link from 'next/link';
import { SEO, Eyebrow, Arrow } from '@/components/ui';
import Explorer from '@/components/blogs/Explorer';
import { getAllBlogs } from '@/utils/mdx';
import { SaveButton } from '@/context/ReadingContext';
export default function Home({ blogs }) {
  const latest = blogs[0];
  return (
    <>
      <SEO
        title="Vikram Kangotra — Notes on building software"
        description="A personal notebook on Rust, open source, and learning how software works. Read, explore, and save stories for later."
      />
      <div className="shell notebook-home">
        <section className="notebook-intro">
          <div className="notebook-intro-top">
            <Eyebrow>VIKRAM’S NOTEBOOK</Eyebrow>
            <span className="edition-label">CODE. CURIOSITY. OCCASIONAL DETOURS.</span>
          </div>
          <h1>
            Good questions.
            <br />
            <span>Interesting rabbit holes.</span>
          </h1>
          <div className="notebook-intro-bottom">
            <p>
              I’m Vikram, a software engineer who likes taking things apart.
              <br className="desktop-break" /> These are my notes on open source, Rust, and figuring
              things out.
            </p>
            <a className="text-link" href="#stories">
              Find something to read <span aria-hidden="true">↓</span>
            </a>
            <Link className="text-link" href="/learn/os">
              Build an OS from scratch <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
        {latest && (
          <section className="featured-story" aria-label="Featured article">
            <div className="featured-label">
              <span className="blue-dot" /> FROM THE NOTEBOOK <span>01 / 06</span>
            </div>
            <div className="featured-content">
              <div>
                <div className="story-meta">
                  <span>VideoLAN</span>
                  <span>·</span>
                  <span>{latest.readingTime}</span>
                </div>
                <Link href={`/blogs/${latest.slug}`}>
                  <h2>
                    Rust, WebAssembly,
                    <br />
                    and a summer with VideoLAN.
                  </h2>
                </Link>
                <p>
                  What it took to bring WebAssembly plugins to VLC—and what I learned along the way.
                </p>
                <Link className="text-link" href={`/blogs/${latest.slug}`}>
                  Read the story <Arrow />
                </Link>
              </div>
              <div className="featured-aside">
                <span className="margin-note">THE THREAD</span>
                <ol>
                  <li>
                    <span>01</span>Start with a familiar tool.
                  </li>
                  <li>
                    <span>02</span>Ask what else it could do.
                  </li>
                  <li>
                    <span>03</span>Learn by building it.
                  </li>
                </ol>
                <SaveButton slug={latest.slug} title={latest.title} withLabel />
              </div>
            </div>
          </section>
        )}
        <div className="notebook-section-heading">
          <h2>The writing.</h2>
          <span>Follow a topic. Find a new direction.</span>
        </div>
        <Explorer blogs={blogs} />
        <section id="about" className="notebook-about">
          <div>
            <Eyebrow>THE PERSON BEHIND THE POSTS</Eyebrow>
            <h2>Hi, I’m Vikram.</h2>
          </div>
          <div>
            <p>
              I build software to understand it. That has led me through compilers, network tools,
              Linux applications, and two summers contributing to VideoLAN.
            </p>
            <p>
              This is where I share the things I figure out. If something here sparks a question,
              I’d love to hear it.
            </p>
            <div className="about-links">
              <Link href="/projects" className="text-link">
                Explore my projects <Arrow />
              </Link>
              <a href="mailto:vikramkangotra8055@gmail.com" className="text-link">
                Say hello <Arrow diagonal />
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
export async function getStaticProps() {
  return { props: { blogs: await getAllBlogs() } };
}
