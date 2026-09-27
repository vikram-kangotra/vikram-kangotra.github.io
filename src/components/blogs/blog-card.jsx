import Link from 'next/link';
import dayjs from 'dayjs';
import { Arrow } from '@/components/ui';
export default function BlogCard({ blog }) {
  return (
    <Link href={`/blogs/${blog.slug}`} className="writing-row">
      <div className="writing-date">
        <time dateTime={blog.publishedAt}>{dayjs(blog.publishedAt).format('MMM DD, YYYY')}</time>
        <span>{blog.readingTime}</span>
      </div>
      <div className="writing-copy">
        <h3>{blog.title}</h3>
        <p>{blog.excerpt}</p>
      </div>
      <Arrow diagonal />
    </Link>
  );
}
