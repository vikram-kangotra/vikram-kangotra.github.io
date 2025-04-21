import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function ProjectCard({ project }) {
    let { name, description, href, imageSrc } = project;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ 
                opacity: 1, 
                y: 0,
                transition: {
                    type: "spring",
                    stiffness: 100,
                    damping: 10
                }
            }}
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ 
                y: -5,
                scale: 1.02,
                transition: { 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 10 
                }
            }}
            className="group relative overflow-hidden rounded-2xl"
        >
            <Link href={href} className="block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-quaternary dark:bg-dark-quaternary">
                    <motion.div
                        initial={{ scale: 1 }}
                        whileHover={{ 
                            scale: 1.1,
                            transition: { 
                                type: "spring", 
                                stiffness: 400, 
                                damping: 10 
                            }
                        }}
                        className="w-full h-full"
                    >
                        <Image 
                            src={imageSrc} 
                            alt={name} 
                            className="object-cover w-full h-full transition-transform duration-500"
                            width={800}
                            height={600}
                        />
                    </motion.div>
                    
                    <motion.div 
                        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-70 group-hover:opacity-80 transition-opacity duration-300"
                        initial={{ opacity: 0.7 }}
                        whileHover={{ opacity: 0.8 }}
                    />
                    
                    <div className="absolute inset-0 p-6 flex flex-col justify-end">
                        <motion.h3 
                            className="text-2xl font-bold text-white mb-2"
                            whileHover={{ x: 5 }}
                        >
                            {name}
                        </motion.h3>
                        <motion.p 
                            className="text-white/80 line-clamp-2"
                            whileHover={{ x: 5 }}
                        >
                            {description}
                        </motion.p>
                        <div className="flex items-center text-white/60 group-hover:text-accent dark:group-hover:text-dark-accent transition-colors duration-300">
                            <span className="text-sm font-medium">View Project</span>
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
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

