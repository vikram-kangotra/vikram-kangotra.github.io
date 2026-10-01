import Link from 'next/link';
import { Arrow } from '@/components/ui';
import ProjectVisual from './project-visual';
export default function ProjectCard({ project, index = 0, heading: Heading = 'h2' }) {
  return (
    <Link className="project-card" href={`/projects/${project.slug}`}>
      <ProjectVisual visual={project.visual} />
      <div className="project-card-body">
        <div className="project-kicker">
          <span>{project.label}</span>
          <span>{String(index + 1).padStart(2, '0')}</span>
        </div>
        <Heading>
          {project.name}
          <Arrow />
        </Heading>
        <p>{project.description}</p>
        <div className="tags">
          {project.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
