import Link from 'next/link';
import dayjs from 'dayjs';
import { SEO, Eyebrow, Arrow } from '@/components/ui';
import ProjectCard from '@/components/projects/project-card';
import projects from '@/constants/projects';
import { topicsFor } from '@/constants/topics';
import { getAllBlogs } from '@/utils/mdx';
import { SaveButton } from '@/context/ReadingContext';

export default function Home({ blogs }) {
  const selectedProjects = projects.filter((project) =>
    ['proto-rs', 'zenos'].includes(project.slug)
  );
  return (
    <>
      <SEO
        title="Vikram Kangotra: Software, from first principles"
        description="Software engineer exploring Rust, compilers, WebAssembly, and operating systems. Explore my projects, open-source notes, and interactive OS course."
      />
      <div className="shell notebook-home">
        <section className="home-intro" aria-labelledby="home-title">
          <div>
            <Eyebrow>VIKRAM KANGOTRA / SOFTWARE ENGINEER</Eyebrow>
            <h1 id="home-title">
              Curiosity,
              <br />
              <span>turned into code.</span>
            </h1>
            <p>
              I’m Vikram. I build software to understand how it works, from compilers and network
              tools to the systems underneath.
            </p>
            <div className="home-actions">
              <Link className="button button-primary" href="/projects">
                Explore my projects <Arrow />
              </Link>
              <Link className="text-link" href="/blogs">
                Read the notebook <Arrow />
              </Link>
            </div>
          </div>
          <nav className="home-index" aria-label="Start exploring">
            <Eyebrow>A FEW PLACES TO START</Eyebrow>
            <Link href="/projects">
              <span className="home-index-number" aria-hidden="true">
                01
              </span>
              <span>
                <strong>The workbench</strong>
                <small>Compilers, systems, and experiments</small>
              </span>
              <Arrow />
            </Link>
            <Link href="/blogs?topic=VideoLAN">
              <span className="home-index-number" aria-hidden="true">
                02
              </span>
              <span>
                <strong>Open-source field notes</strong>
                <small>Two summers building with VideoLAN</small>
              </span>
              <Arrow />
            </Link>
            <Link href="/learn/os" prefetch={false}>
              <span className="home-index-number" aria-hidden="true">
                03
              </span>
              <span>
                <strong>Build an operating system</strong>
                <small>An interactive course, in your browser</small>
              </span>
              <Arrow />
            </Link>
          </nav>
        </section>

        <section className="home-work" aria-labelledby="selected-work-title">
          <div className="home-section-heading">
            <div>
              <Eyebrow>SELECTED WORK</Eyebrow>
              <h2 id="selected-work-title">Built to understand.</h2>
            </div>
            <Link className="text-link" href="/projects">
              All {projects.length} projects <Arrow />
            </Link>
          </div>
          <div className="project-grid">
            {selectedProjects.map((project) => (
              <ProjectCard
                heading="h3"
                key={project.slug}
                project={project}
                index={projects.indexOf(project)}
              />
            ))}
          </div>
        </section>

        <section className="home-course" aria-labelledby="course-title">
          <div className="course-note" aria-hidden="true">
            <span>THE FIRST INSTRUCTION</span>
            <code>
              <b>mov</b> ax, 0x07c0
              <br />
              <b>mov</b> ds, ax
              <br />
              <span>; start from the beginning</span>
            </code>
          </div>
          <div>
            <Eyebrow>LEARN BY DOING</Eyebrow>
            <h2 id="course-title">From bits to a booting machine.</h2>
            <p>
              Build an operating system from scratch. Read the lessons, write assembly, and run your
              code in the browser.
            </p>
            <Link href="/learn/os" prefetch={false} className="text-link">
              Explore the OS course <Arrow />
            </Link>
          </div>
        </section>

        <section className="home-writing" id="stories" aria-labelledby="latest-writing-title">
          <div className="home-section-heading">
            <div>
              <Eyebrow>FROM THE NOTEBOOK</Eyebrow>
              <h2 id="latest-writing-title">Things I’ve figured out.</h2>
            </div>
            <Link className="text-link" href="/blogs">
              All writing <Arrow />
            </Link>
          </div>
          <div className="home-stories">
            {blogs.slice(0, 3).map((blog, index) => (
              <article key={blog.slug} className="home-story">
                <div className="home-story-date">
                  <span>{index === 0 ? 'LATEST ENTRY' : topicsFor(blog.slug)[0]}</span>
                  <time dateTime={blog.publishedAt}>
                    {dayjs(blog.publishedAt).format('MMM D, YYYY')}
                  </time>
                </div>
                <div className="home-story-content">
                  <Link href={`/blogs/${blog.slug}`}>
                    <h3>{blog.title}</h3>
                  </Link>
                  <p>{blog.excerpt}</p>
                  <span className="home-story-time">{blog.readingTime}</span>
                </div>
                <SaveButton slug={blog.slug} title={blog.title} />
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="notebook-about">
          <div>
            <Eyebrow>THE PERSON BEHIND THE CODE</Eyebrow>
            <h2>
              Always a student.
              <br />
              Usually building.
            </h2>
          </div>
          <div>
            <p>
              I’m a software engineer drawn to the details: how a compiler turns an idea into
              instructions, how packets travel, and what happens before a computer boots.
            </p>
            <p>
              That curiosity has led me through Rust projects, Linux applications, and two summers
              contributing to VideoLAN. This is where I share the work and the lessons along the
              way.
            </p>
            <div className="about-links">
              <a
                href="https://github.com/vikram-kangotra"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Find me on GitHub <Arrow diagonal />
              </a>
              <a href="mailto:vikramkangotra8055@gmail.com" className="text-link">
                Say hello <Arrow />
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
