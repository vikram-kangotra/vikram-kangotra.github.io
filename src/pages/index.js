import Blogs from "@/components/blogs";
import Hero from "@/components/hero";
import Introduction from "@/components/introduction";
import Projects from "@/components/projects";
import {getAllBlogs} from "@/utils/mdx"

export default function Home({blogs}) {
  return (
    <main>
      <div className="relative">
        <div className="overflow-hidden absolute bg-pink-300 rounded-full left-[30%] top-[25%] opacity-20 blur-3xl w-72 h-72"></div>
        <div className="overflow-hidden absolute bg-yellow-300 rounded-full right-[30%] top-[8%] blur-3xl w-72 h-72 opacity-20"></div>
        <Hero />
        <Introduction />
        <Projects />
        <Blogs blogs={blogs}/>
      </div>
    </main>
  )
}

export async function getStaticProps() {
    const blogs = await getAllBlogs();
    
    blogs.map((blog) => blog.data)
    .sort((a, b) => {
        if (a.data.publishedAt < b.data.publishedAt) {
            return 1
        } else if (a.data.publishedAt > b.data.publishedAt) {
            return -1
        }
        return 0
    })

    return {
        props: {
            blogs: blogs.reverse(),
        },
    }
}
