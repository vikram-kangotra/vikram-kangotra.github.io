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
        const [slug, _extension] = fileName.split('.');

        return slug;
    });
}

export async function getBlogFromSlug(slug) {
    const blogPath = path.join(blogsPath, `${slug}.mdx`);
    const source = fs.readFileSync(blogPath);
    const { data, content, } = matter(source);

    return {
        content,
        frontmatter: {
            slug,
            excerpt: data.excerpt,
            title: data.title,
            publishedAt: data.publishedAt,
            readingTime: readingTime(source).text,
            ...data,
        }
    }
}

export async function getAllBlogs() {
    const blogs = fs.readdirSync(blogsPath);

    return blogs.reduce((allBlogs, blogSlug) => {
        const source = fs.readFileSync(path.join(blogsPath, blogSlug));
        const { data } = matter(source);

        return [
            {
                ...data,
                slug: blogSlug.replace('.mdx', ''),
                readingTime: readingTime(source).text,
            },
            ...allBlogs,
        ]
    }, [])
}
