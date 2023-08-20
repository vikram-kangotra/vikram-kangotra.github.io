import {getAllBlogs} from "@/utils/mdx"
import { BlogCard } from "@/components/blogs"
import dayjs from "dayjs";

export default function BlogPage({blogs}) {
    return (

        <div className="flex flex-col items-center justify-start p-10 overflow-hidden">
            <div className='flex flex-col items-center content-center justify-start py-10 overflow-hidden md:py-20 gap-16 md:gap-28'>
                
                <div className="flex flex-col items-start content-start justify-start max-w-4xl overflow-visible gap-5 min-h-max">

                    <div className="grid grid-cols-1 gap-5">
                        {
                            blogs.map((blog, index) => {
                                return (
                                    <BlogCard blog={blog} key={index}/>
                                )
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}

export async function getStaticProps() {
    const blogs = await getAllBlogs();

    /*
    blogs.map((blog) => blog.data)
    .sort((a, b) => {
        a = dayjs(a.publishedAt)
        b = dayjs(b.publishedAt)

        if (a.isAfter(b)) return -1
        if (a.isBefore(b)) return 1
        return 0
    })
    */

    return {
        props: {
            blogs: blogs,
        },
    }
}
