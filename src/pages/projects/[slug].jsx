import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import projects from "@/constants/projects";

export default function ProjectPage({ project }) {
    if (!project) {
        return (
            <div className="min-h-screen bg-tertiary dark:bg-dark-tertiary flex items-center justify-center">
                <p className="text-primary dark:text-dark-primary">Project not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-tertiary dark:bg-dark-tertiary">
            <div className="container mx-auto px-4 py-20">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-4xl mx-auto"
                >
                    <Link 
                        href="/projects" 
                        className="inline-flex items-center text-accent dark:text-dark-accent hover:text-accent/80 dark:hover:text-dark-accent/80 transition-colors duration-300 mb-8"
                    >
                        <svg 
                            className="w-4 h-4 mr-2" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24" 
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth="2" 
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                        Back to Projects
                    </Link>

                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl mb-8">
                        <Image 
                            src={project.imageSrc} 
                            alt={project.name} 
                            className="object-cover w-full h-full"
                            width={1200}
                            height={900}
                        />
                    </div>

                    <h1 className="text-4xl font-bold text-primary dark:text-dark-primary mb-4">
                        {project.name}
                    </h1>

                    <p className="text-secondary dark:text-dark-secondary text-lg mb-8">
                        {project.description}
                    </p>

                    <a 
                        href={project.href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-accent dark:bg-dark-accent text-white rounded-lg hover:bg-accent/90 dark:hover:bg-dark-accent/90 transition-colors duration-300"
                    >
                        View on GitHub
                        <svg 
                            className="w-4 h-4 ml-2" 
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
                    </a>
                </motion.div>
            </div>
        </div>
    );
}

export async function getStaticPaths() {
    const paths = projects.map((project) => ({
        params: { slug: project.name.toLowerCase().replace(/\s+/g, '-') },
    }));

    return {
        paths,
        fallback: false,
    };
}

export async function getStaticProps({ params }) {
    const project = projects.find(
        (p) => p.name.toLowerCase().replace(/\s+/g, '-') === params.slug
    );

    return {
        props: {
            project: project || null,
        },
    };
} 