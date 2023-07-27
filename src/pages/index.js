import Blogs from "@/components/blogs";
import Hero from "@/components/hero";
import Interest from "@/components/interest";
import Introduction from "@/components/introduction";
import Projects from "@/components/projects";

export default function Home() {
  return (
    <main>
      <Hero />
      <Interest />
      <Introduction />
      <Projects />
      <Blogs />
    </main>
  )
}
