import Blogs from "@/components/blogs";
import Hero from "@/components/hero";
import Interest from "@/components/interest";
import Introduction from "@/components/introduction";
import Projects from "@/components/projects";
import {getAllBlogs} from "@/utils/mdx"

export default function Home({blogs}) {
  return (
    <main>
      <Hero />
      <Introduction />
      <Projects />
      <Blogs blogs={blogs}/>
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
