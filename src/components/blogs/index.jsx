import Link from "next/link";
import BlogCard from "./blog-card";

export default function Blogs({blogs}) {
    return (
        <div className="flex flex-col items-center justify-start p-6 md:p-10 overflow-hidden">
            <div className="flex flex-col items-start content-start justify-start max-w-4xl w-full overflow-visible gap-5 min-h-max">
                <p className="text-2xl font-medium text-gray-900 dark:text-dark-primary opacity-60">Latest Blogs</p>
                <div className="grid grid-cols-1 gap-5 w-full">
                    {
                        blogs.slice(0,3).map((blog, index) => (
                            <BlogCard key={index} blog={blog} />
                        ))
                    }
                </div>
                <p className="w-full text-base text-right text-gray-500 dark:text-dark-secondary">
                    <Link href="/blogs" className="inline-flex items-center font-medium text-accent dark:text-dark-accent hover:underline">
                        Read all blogs
                        <svg className="w-4 h-4 ml-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                        </svg>
                    </Link> 
                </p>
            </div>
        </div>
    )
}

export {
    BlogCard
}
