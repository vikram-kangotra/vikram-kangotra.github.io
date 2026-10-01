import { getAllBlogs } from '@/utils/mdx';
import { useRouter } from 'next/router';
import Link from 'next/link';
import projects from '@/constants/projects';
import ProjectCard from '@/components/projects/project-card';
import { SEO, Eyebrow } from '@/components/ui';
const categories = ['All', 'Systems', 'Languages', 'Libraries', 'Applications'];
export default function Projects() {
  const router = useRouter();
  const filter = categories.includes(router.query.category) ? router.query.category : 'All';
  function setFilter(category) {
    const query = { ...router.query };
    if (category === 'All') delete query.category;
    else query.category = category;
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false,
    });
  }
  const visible = projects.filter((p) => filter === 'All' || p.category === filter);
  return (
    <div className="shell index-page">
      <SEO
        title="Projects: Vikram Kangotra"
        description="Compilers, operating systems, network tools, and experiments in Rust. Explore projects by Vikram Kangotra."
        path="/projects"
      />
      <div className="page-intro">
        <Eyebrow>THE WORKBENCH</Eyebrow>
        <h1>Built to understand.</h1>
        <p>
          Some practical. Some experimental. All driven by the same question: how does this work?
        </p>
      </div>
      <div className="filter-bar">
        <div className="filters" role="group" aria-label="Filter projects">
          {categories.map((category) => (
            <button
              key={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category}{' '}
              <span className="filter-count">
                {
                  projects.filter((project) => category === 'All' || project.category === category)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <span className="result-count" role="status">
          {visible.length} {visible.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      <section aria-label="Projects" className="project-grid">
        {visible.map((project) => (
          <ProjectCard key={project.slug} project={project} index={projects.indexOf(project)} />
        ))}
      </section>
      <div className="projects-course-link">
        <p>Want to explore systems by building one?</p>
        <Link className="text-link" href="/learn/os" prefetch={false}>
          Try the interactive OS course <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

export async function getStaticProps() {
  return { props: { blogs: await getAllBlogs() } };
}
