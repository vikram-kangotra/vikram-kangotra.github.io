import projects from "@/constants/projects";
import Link from "next/link";
import ProjectCard from "./project-card";
import { motion } from "framer-motion";

export default function Projects() {
    return (
        <div className="flex flex-col items-center justify-start px-4 md:px-5 py-20 overflow-hidden bg-tertiary dark:bg-dark-tertiary">
            <div className="flex flex-col items-start justify-start w-full max-w-6xl gap-8">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col gap-2 w-full"
                >
                    <h2 className="text-3xl font-bold text-primary dark:text-dark-primary">
                        Featured Projects
                    </h2>
                    <p className="text-secondary dark:text-dark-secondary max-w-2xl">
                        Explore my latest projects and see how I bring ideas to life with modern technologies and creative solutions
                    </p>
                </motion.div>

                <div className="relative w-full">
                    {/* Background gradient effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-purple-500/10 dark:from-dark-accent/10 dark:to-purple-400/10 rounded-3xl blur-3xl" />

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 relative z-10"
                    >
                        {projects
                            .filter((_project, index) => index < 4)
                            .map((project, index) => (
                                <ProjectCard key={index} project={project} />
                            ))}
                    </motion.div>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="w-full mt-4"
                >
                    <Link 
                        href="/projects" 
                        className="inline-flex items-center font-medium text-accent dark:text-dark-accent hover:text-accent/80 dark:hover:text-dark-accent/80 transition-colors duration-300"
                    >
                        Explore all projects
                        <svg 
                            className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24" 
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth="2" 
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                        </svg>
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}

