import { getAllBlogs } from '@/utils/mdx';
import Link from 'next/link';
import Image from 'next/image';
import projects from '@/constants/projects';
import { SEO, Eyebrow, Arrow } from '@/components/ui';
export default function Project({ project }) {
  return (
    <div className="shell project-detail">
      <SEO
        title={`${project.name} — Vikram Kangotra`}
        description={project.description}
        path={`/projects/${project.slug}`}
      />
      <Link className="back-link" href="/projects">
        ← All projects
      </Link>
      <div className="project-detail-header">
        <div>
          <Eyebrow>{project.label}</Eyebrow>
          <h1>{project.name}</h1>
          <p>{project.description}</p>
          <div className="tags">
            {project.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <a
          className="button button-primary"
          href={project.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          View source <Arrow diagonal />
        </a>
      </div>
      <div className="project-screenshot">
        <Image
          src={project.imageSrc}
          alt={`${project.name} project preview`}
          sizes="(max-width: 800px) 90vw, 1100px"
          priority
        />
      </div>
      <div className="project-overview">
        <Eyebrow>ABOUT THE PROJECT</Eyebrow>
        <p>{project.detail}</p>
      </div>
      <Link className="text-link" href="/projects">
        Explore more projects <Arrow />
      </Link>
    </div>
  );
}
export function getStaticPaths() {
  return {
    paths: projects.map((project) => ({ params: { slug: project.slug } })),
    fallback: false,
  };
}
export async function getStaticProps({ params }) {
  const project = projects.find((p) => p.slug === params.slug);
  return project ? { props: { project, blogs: await getAllBlogs() } } : { notFound: true };
}
