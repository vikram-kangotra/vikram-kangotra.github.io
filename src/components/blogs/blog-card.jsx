import Link from "next/link";
import { motion } from "framer-motion";
import dayjs from "dayjs";

export default function BlogCard({ blog, title, date, excerpt, slug, tags }) {
    // Handle both old and new data structures
    const blogTitle = title || blog?.title;
    const blogDate = date || (blog?.publishedAt ? dayjs(blog.publishedAt).format('MMMM D, YYYY') : '');
    const blogExcerpt = excerpt || blog?.excerpt;
    const blogSlug = slug || blog?.slug;
    const blogTags = tags || blog?.tags || [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ 
                opacity: 1, 
                y: 0,
                transition: {
                    type: "spring",
                    stiffness: 100,
                    damping: 10
                }
            }}
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ 
                y: -5,
                scale: 1.02,
                transition: { 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 10 
                }
            }}
            className="group relative overflow-hidden rounded-2xl bg-quaternary dark:bg-dark-quaternary hover:shadow-xl transition-all duration-300"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-purple-500/10 dark:from-dark-accent/10 dark:to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <Link href={`/blogs/${blogSlug}`} className="block p-6">
                <div className="flex flex-col h-full">
                    <div className="flex-1">
                        <motion.h3 
                            className="text-xl font-bold text-primary dark:text-dark-primary mb-2 group-hover:text-accent dark:group-hover:text-dark-accent transition-colors duration-300"
                            whileHover={{ x: 5 }}
                        >
                            {blogTitle}
                        </motion.h3>
                        <p className="text-sm text-secondary dark:text-dark-secondary mb-4">
                            {blogDate}
                        </p>
                        <p className="text-secondary dark:text-dark-secondary mb-4 line-clamp-3">
                            {blogExcerpt}
                        </p>
                    </div>
                    
                    {blogTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {blogTags.map((tag, index) => (
                                <motion.span 
                                    key={index}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileInView={{ 
                                        opacity: 1, 
                                        scale: 1,
                                        transition: {
                                            delay: index * 0.1,
                                            type: "spring",
                                            stiffness: 200,
                                            damping: 10
                                        }
                                    }}
                                    viewport={{ once: true }}
                                    className="px-3 py-1 text-xs font-medium rounded-full bg-accent/10 dark:bg-dark-accent/10 text-accent dark:text-dark-accent"
                                >
                                    {tag}
                                </motion.span>
                            ))}
                        </div>
                    )}

                    <motion.div 
                        className="mt-4 flex items-center text-accent dark:text-dark-accent group-hover:translate-x-1 transition-transform duration-300"
                        whileHover={{ x: 5 }}
                    >
                        <span className="text-sm font-medium">Read more</span>
                        <motion.svg 
                            className="w-4 h-4 ml-1" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24" 
                            xmlns="http://www.w3.org/2000/svg"
                            whileHover={{ x: 5 }}
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth="2" 
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                        </motion.svg>
                    </motion.div>
                </div>
            </Link>
        </motion.div>
    );
}

