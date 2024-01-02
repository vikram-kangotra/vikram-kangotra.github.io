import ProjectCard from "@/components/projects/project-card"
import projects from "@/constants/projects"

const ProjectPage = () => {
    return (

        <div className="flex flex-col items-center p-10 overflow-hidden">
                <div className="relative">

                    <div className="absolute w-full h-full overflow-hidden bg-blue-300 rounded-full opacity-10 blur-3xl -right-20"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-2 md:gap-5">
                            {
                                projects.map((project, index) => (
                                    <ProjectCard key={index} project={project} />
                                ))
                            }
                    </div>
            </div>
        </div>
    )
}

export default ProjectPage
