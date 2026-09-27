import Link from 'next/link';
import { Arrow } from '@/components/ui';
export default function ProjectCard({ project, index = 0 }) {
  return (
    <Link className="project-card" href={`/projects/${project.slug}`}>
      <div className="project-card-body">
        <div className="project-kicker">
          <span>{project.label}</span>
          <span>{String(index + 1).padStart(2, '0')}</span>
        </div>
        <h3>
          {project.name}
          <Arrow diagonal />
        </h3>
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
