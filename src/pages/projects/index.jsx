import { getAllBlogs } from '@/utils/mdx';
import { useState } from 'react';
import projects from '@/constants/projects';
import ProjectCard from '@/components/projects/project-card';
import { SEO, Eyebrow } from '@/components/ui';
const categories = ['All', 'Systems', 'Languages', 'Libraries', 'Applications'];
export default function Projects() {
  const [filter, setFilter] = useState('All');
  const visible = projects.filter((p) => filter === 'All' || p.category === filter);
  return (
    <div className="shell index-page">
      <SEO
        title="Projects — Vikram Kangotra"
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
        <div className="filters" aria-label="Filter projects">
          {categories.map((category) => (
            <button
              key={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <span className="result-count" role="status">
          {visible.length} projects
        </span>
      </div>
      <div className="project-grid">
        {visible.map((project) => (
          <ProjectCard key={project.slug} project={project} index={projects.indexOf(project)} />
        ))}
      </div>
    </div>
  );
}

export async function getStaticProps() {
  return { props: { blogs: await getAllBlogs() } };
}
