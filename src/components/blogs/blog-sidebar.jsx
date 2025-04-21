'use client';

import Link from 'next/link';

const BlogSidebar = ({ blogs = [], currentSlug }) => {
    if (!Array.isArray(blogs) || blogs.length === 0) {
        return (
            <div className="sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto w-full">
                <div className="bg-quaternary dark:bg-dark-quaternary rounded-lg p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-primary dark:text-dark-primary mb-4">
                        All Blogs
                    </h2>
                    <p className="text-secondary dark:text-dark-secondary">
                        No blogs available
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto w-full">
            <div className="bg-quaternary dark:bg-dark-quaternary rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-primary dark:text-dark-primary mb-4">
                    All Blogs
                </h2>
                <div className="space-y-2">
                    {blogs.map((blog) => (
                        <Link
                            key={blog.slug}
                            href={`/blogs/${blog.slug}`}
                            className={`block p-3 rounded-lg transition-colors duration-200 ${
                                blog.slug === currentSlug
                                    ? 'bg-accent text-white dark:bg-dark-accent'
                                    : 'hover:bg-hover-light dark:hover:bg-hover-dark text-primary dark:text-dark-primary'
                            }`}
                        >
                            <div className="font-medium truncate">{blog.title}</div>
                            <div className={`text-sm ${
                                blog.slug === currentSlug
                                    ? 'text-white/80 dark:text-white/80'
                                    : 'text-secondary dark:text-dark-secondary'
                            }`}>
                                {new Date(blog.publishedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BlogSidebar; 