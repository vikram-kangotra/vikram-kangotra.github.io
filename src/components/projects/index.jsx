import projects from "@/constants/projects"
import { Syne } from "next/font/google"
import Link from "next/link"
import ProjectCard from "./project-card"

const syne = Syne({ subsets: ['latin'], weights: ['400', '700'] })

export default function Projects() {
    return (
        <div className="flex flex-col items-center justify-start p-10 overflow-hidden">
            <div className="flex flex-col items-start content-start justify-start max-w-4xl overflow-visible gap-5 min-h-max">
                <p className="text-2xl font-medium opacity-60">Projects</p>
                <div className="grid grid-cols-2 grid-rows-2 gap-2 md:gap-5">
                    {
                        projects.map((project, index) => (
                            <ProjectCard key={index} href={projects[index].href} imageSrc={projects[index].imageSrc} projectName={projects[index].name} />
                        ))
                    }
                </div>
                <p className="w-full text-base text-right text-gray-500 dark:text-gray-400">
                    More projects are waiting to be explored.
                    <Link href="#" className="inline-flex items-center font-medium text-blue-600 dark:text-blue-500 hover:underline">
                        Explore all projects
                        <svg className="w-4 h-4 ml-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                        </svg>
                    </Link> 
                </p>
            </div>
        </div>
    )
}
