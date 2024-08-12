import {getAllBlogs} from "@/utils/mdx"
import { BlogCard } from "@/components/blogs"
import dayjs from "dayjs";

export default function BlogPage({groupedBlogs}) {

    const sortedGroupedBlogs = Object.keys(groupedBlogs).sort((a, b) => b - a);

    return (
        <div className="flex flex-col items-center p-10 overflow-hidden">
            <div className='flex flex-col items-center max-w-4xl py-10 md:py-20 gap-16 md:gap-28'>
                <div className="grid grid-cols-1 gap-5">
                    {sortedGroupedBlogs.map((year) => (
                        <YearSection key={year} year={year} blogs={groupedBlogs[year]} />
                    ))}
                </div>
            </div>
        </div>
    )
}

function YearSection({ year, blogs }) {
    return (
        <div className="relative flex flex-col md:flex-row gap-5">
            
            <h2 className="relative z-10 text-2xl font-medium text-white opacity-60 md:pl-5">
                {year}
            </h2>
            
            <div className="flex flex-col flex-1 gap-5">
                {blogs.map((blog, index) => (
                    <BlogCard key={index} blog={blog} className="w-full" />
                ))}
            </div>
        </div>
    );
}

export async function getStaticProps() {
    let blogs = await getAllBlogs();

    blogs.sort((a, b) => {
        a = dayjs(a.publishedAt)
        b = dayjs(b.publishedAt)

        if (a.isAfter(b)) return -1
        if (a.isBefore(b)) return 1
        return 0
    })

    const groupedBlogs = blogs.reduce((acc, blog) => {
        const year = dayjs(blog.publishedAt).year();
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(blog);
        return acc;
    }, {});

    return {
        props: {
            groupedBlogs,
        },
    };
}
