import projects from "@/constants/projects";
import Link from "next/link";
import ProjectCard from "./project-card";

export default function Projects() {
    return (
        <div className="flex flex-col items-center justify-start px-5 py-10 overflow-hidden">
            <div className="flex flex-col items-start justify-start w-full max-w-4xl gap-5">
                <p className="text-2xl font-medium text-white opacity-60">Projects</p>
                <div className="relative w-full">

                    <div className="absolute w-full h-full overflow-hidden bg-blue-300 rounded-full opacity-10 blur-3xl -right-20"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {projects
                            .filter((_project, index) => index < 4)
                            .map((project, index) => (
                                <ProjectCard key={index} project={project} />
                            ))}
                    </div>
                </div>
                <p className="w-full mt-5 text-base text-right text-gray-500">
                    <Link href="/projects" className="inline-flex items-center font-medium text-purple-600 hover:underline">
                        Explore all projects
                        <svg className="w-4 h-4 ml-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                        </svg>
                    </Link> 
                </p>
            </div>
        </div>
    );
}

