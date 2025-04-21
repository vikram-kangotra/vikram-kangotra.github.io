import React, {useEffect, useState} from "react";
import Head from "next/head";
import Image from "next/image";
import rehypeCodeTitles from "rehype-code-titles";
import rehypePrism from "rehype-prism-plus";
import rehypeSlug from "rehype-slug";
import { getBlogFromSlug, getSlug } from "@/utils/mdx";
import { serialize } from "next-mdx-remote/serialize";
import dayjs from "dayjs";
import {MDXRemote} from "next-mdx-remote";
import Link from "next/link";
import CustomLink from "@/components/customlink";
import BlogSidebar from "../../components/blogs/blog-sidebar";

function Previous({link}) {
    if (link === null) {
        return <></>;
    }

    return (
        <Link 
            href={link} 
            className="group relative flex-1 h-32 rounded-xl overflow-hidden bg-quaternary dark:bg-dark-quaternary hover:shadow-lg transition-all duration-300"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-purple-500/10 dark:from-dark-accent/10 dark:to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex flex-col items-center justify-center h-full p-6">
                <div className="flex items-center gap-2 text-accent dark:text-dark-accent font-medium mb-2">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">←</span>
                    <span>Previous</span>
                </div>
                <div className="text-sm text-secondary dark:text-dark-secondary text-center line-clamp-2">
                    {link.split('/').pop().replace(/-/g, ' ')}
                </div>
            </div>
        </Link>
    );
}

function Next({link}) {
    if (link === null) {
        return <></>;
    }

    return (
        <Link 
            href={link} 
            className="group relative flex-1 h-32 rounded-xl overflow-hidden bg-quaternary dark:bg-dark-quaternary hover:shadow-lg transition-all duration-300"
        >
            <div className="absolute inset-0 bg-gradient-to-l from-accent/10 to-purple-500/10 dark:from-dark-accent/10 dark:to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex flex-col items-center justify-center h-full p-6">
                <div className="flex items-center gap-2 text-accent dark:text-dark-accent font-medium mb-2">
                    <span>Next</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
                </div>
                <div className="text-sm text-secondary dark:text-dark-secondary text-center line-clamp-2">
                    {link.split('/').pop().replace(/-/g, ' ')}
                </div>
            </div>
        </Link>
    );
}

// Add custom code block component
const CodeBlock = ({ className, children }) => {
    const language = className?.replace('language-', '') || 'text';
    return (
        <div className="relative">
            <div className="absolute top-0 right-0 px-3 py-1 text-xs font-medium text-secondary dark:text-dark-secondary bg-quaternary dark:bg-dark-quaternary rounded-bl-lg rounded-tr-lg">
                {language}
            </div>
            <pre className={className}>
                {children}
            </pre>
        </div>
    );
};

const Blog = ({ post: {source, frontmatter}, previous, next, allBlogs }) => {
    const [date, setDate] = useState(null);

    useEffect(() => {
        setDate(dayjs(frontmatter.publishedAt).format('MMMM D, YYYY'));
    }, [frontmatter.publishedAt]);

    return (
        <div className="min-h-screen bg-tertiary dark:bg-dark-tertiary">
            <Head>
                <title>{frontmatter.title}</title>
            </Head>
            <div className="container mx-auto px-4 py-8">
                <div className="flex gap-8">
                    {/* Sidebar - Fixed width */}
                    <div className="hidden lg:block w-80 flex-shrink-0">
                        <BlogSidebar blogs={allBlogs} currentSlug={frontmatter.slug} />
                    </div>
                    
                    {/* Main Content - Flexible width */}
                    <div className="flex-1 min-w-0">
                        <article className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-p:leading-relaxed prose-p:text-secondary dark:prose-p:text-dark-secondary prose-a:text-accent dark:prose-a:text-dark-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-primary dark:prose-strong:text-dark-primary prose-blockquote:border-l-4 prose-blockquote:border-accent dark:prose-blockquote:border-dark-accent prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-secondary dark:prose-blockquote:text-dark-secondary prose-code:bg-quaternary dark:prose-code:bg-dark-quaternary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-quaternary dark:prose-pre:bg-dark-quaternary prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:relative prose-img:rounded-lg prose-img:shadow-md prose-img:mx-auto prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-accent dark:prose-li:marker:text-dark-accent">
                            <h1 className="text-4xl font-bold text-primary dark:text-dark-primary mb-4">
                                {frontmatter.title}
                            </h1>
                            <div className="text-secondary dark:text-dark-secondary mb-12 text-lg">
                                {date} &mdash; {frontmatter.readingTime}
                            </div>
                            <MDXRemote 
                                {...source} 
                                components={{ 
                                    Image, 
                                    a: CustomLink,
                                    pre: CodeBlock
                                }} 
                            />
                        </article>
                        
                        <div className="flex gap-6 my-12">
                            <Previous link={previous}/>
                            <Next link={next}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Blog;

export async function getStaticPaths() {
    const paths = (await getSlug()).map((slug) => ({ params: { slug } }))

    return {
        paths,
        fallback: false,
    }
}

export async function getStaticProps({params}) {
    const { slug } = params;
    const { content, frontmatter } = await getBlogFromSlug(slug);

    const mdxSource = await serialize(content, {
        mdxOptions: {
            rehypePlugins: [
                rehypeSlug,
                rehypePrism,
                rehypeCodeTitles,
            ],
        }
    });

    // Get all blogs data first
    let allBlogs = [];
    try {
        const paths = await getSlug();
        allBlogs = await Promise.all(
            paths.map(async (blogSlug) => {
                const { frontmatter: blogFrontmatter } = await getBlogFromSlug(blogSlug);
                return {
                    slug: blogSlug,
                    title: blogFrontmatter.title,
                    publishedAt: blogFrontmatter.publishedAt,
                };
            })
        );

        // Sort blogs by date (newest first)
        allBlogs.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        // Find the current blog's index in the sorted array
        const currentIndex = allBlogs.findIndex(blog => blog.slug === slug);

        // Since we're sorting newest first, the logic needs to be reversed:
        // Next is the newer post (index - 1)
        const next = currentIndex > 0 ? allBlogs[currentIndex - 1].slug : null;
        // Previous is the older post (index + 1)
        const previous = currentIndex < allBlogs.length - 1 ? allBlogs[currentIndex + 1].slug : null;

        return {
            props: {
                post: {
                    source: mdxSource,
                    frontmatter,
                },
                previous,
                next,
                allBlogs,
            }
        }
    } catch (error) {
        console.error('Error fetching blog data:', error);
        return {
            props: {
                post: {
                    source: mdxSource,
                    frontmatter,
                },
                previous: null,
                next: null,
                allBlogs: [],
            }
        }
    }
}
