import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import { sync } from 'glob';

const blogsPath = path.join(process.cwd(), 'src/blogs');

export async function getSlug() {
  const paths = sync(`${blogsPath}/*.mdx`);

  return paths.map((path) => {
    const pathContent = path.split('/');
    const fileName = pathContent[pathContent.length - 1];
    const [slug] = fileName.split('.');

    return slug;
  });
}

export async function getBlogFromSlug(slug) {
  const blogPath = path.join(blogsPath, `${slug}.mdx`);
  const source = fs.readFileSync(blogPath);
  const { data, content } = matter(source);

  return {
    content,
    frontmatter: {
      slug,
      excerpt: data.excerpt,
      title: data.title,
      publishedAt: data.publishedAt,
      readingTime: readingTime(content).text,
      ...data,
    },
  };
}

export async function getAllBlogs() {
  const blogs = fs
    .readdirSync(blogsPath)
    .filter((name) => name.endsWith('.mdx') && !name.startsWith('.'));

  return blogs
    .reduce((allBlogs, blogSlug) => {
      const source = fs.readFileSync(path.join(blogsPath, blogSlug));
      const { data, content } = matter(source);

      return [
        {
          ...data,
          slug: blogSlug.replace('.mdx', ''),
          readingTime: readingTime(content).text,
        },
        ...allBlogs,
      ];
    }, [])
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
