import {getAllBlogs} from "@/utils/mdx"
import { BlogCard } from "@/components/blogs"
import dayjs from "dayjs";

export default function BlogPage({groupedBlogs}) {

    const sortedGroupedBlogs = Object.keys(groupedBlogs).sort((a, b) => b - a);

    return (
        <div className="flex flex-col items-center p-10">
            <div className='flex flex-col items-center max-w-4xl gap-8 md:gap-14'>
                {sortedGroupedBlogs.map((year) => (
                    <YearSection key={year} year={year} blogs={groupedBlogs[year]} />
                ))}
            </div>
        </div>
    )
}

function YearSection({ year, blogs }) {
    return (
        <div className="relative flex flex-col md:flex-row gap-5">
            
            <h2 className="relative text-2xl font-medium text-white opacity-60 md:pl-5">
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
    const blogs = await getAllBlogs();

    const sortedBlogs = blogs.sort((a, b) => 
        dayjs(b.publishedAt).diff(dayjs(a.publishedAt))
    );

    const groupedBlogs = sortedBlogs.reduce((acc, blog) => {
        const year = dayjs(blog.publishedAt).year();
        if (!acc[year]) acc[year] = [];
        acc[year].push(blog);
        return acc;
    }, {});

    return {
        props: {
            groupedBlogs,
        },
    };
}

