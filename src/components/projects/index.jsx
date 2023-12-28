import projects from "@/constants/projects"
import Link from "next/link"
import ProjectCard from "./project-card"

export default function Projects() {
    return (
        <div className="flex flex-col items-center justify-start p-10 overflow-hidden">
            <div className="flex flex-col items-start content-start justify-start max-w-4xl overflow-visible gap-5 min-h-max">
                <p className="text-2xl font-medium text-white opacity-60">Projects</p>
                <div className="relative">

                    <div className="overflow-hidden absolute bg-blue-300 rounded-full opacity-10 blur-3xl w-full h-full -right-20"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-2 md:gap-5">
                            {

                                projects.filter((_project, index) => index < 4).map((project, index) => (
                                    <ProjectCard key={index} href={project.href} imageSrc={project.imageSrc} projectName={project.name} />
                                ))
                            }
                    </div>
                </div>
                <p className="w-full text-base text-right text-gray-500">
                    <Link href="/projects" className="inline-flex items-center font-medium text-purple-600 hover:underline">
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
