import Blogs from "@/components/blogs";
import Hero from "@/components/hero";
import Introduction from "@/components/introduction";
import Projects from "@/components/projects";
import {getAllBlogs} from "@/utils/mdx"
import dayjs from "dayjs";

export default function Home({blogs}) {
  return (
    <main>
      <div>
        <Hero />
        <Introduction />
        <Projects />
        <Blogs blogs={blogs}/>
      </div>
    </main>
  )
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

    return {
        props: {
            blogs: blogs,
        },
    }
}
