import { motion } from "framer-motion";
import HeroButton from "./heroButton";
import { useState, useEffect } from "react";
import ThemeToggle from '@/components/ThemeToggle';

export default function Hero() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { 
            opacity: 0,
            y: 20
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 10
            }
        }
    };

    const textVariants = {
        hidden: { 
            opacity: 0,
            x: -20
        },
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 10
            }
        }
    };

    return (
        <motion.div 
            className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-b from-tertiary to-quaternary dark:from-dark-tertiary dark:to-dark-quaternary overflow-hidden"
            initial="hidden"
            animate={isVisible ? "visible" : "hidden"}
            variants={containerVariants}
        >
            {/* Theme Toggle Button */}
            <motion.div 
                className="absolute top-4 right-4 z-20"
                variants={itemVariants}
            >
                <ThemeToggle />
            </motion.div>

            {/* Background gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-tertiary via-quaternary to-tertiary dark:from-dark-tertiary dark:via-dark-quaternary dark:to-dark-tertiary" />
            
            {/* Animated background shapes */}
            <motion.div 
                className="fixed inset-0 opacity-10"
                animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                <div className="absolute top-0 left-0 w-32 h-32 md:w-64 md:h-64 bg-accent rounded-full blur-3xl dark:bg-dark-accent" />
                <div className="absolute bottom-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-purple-500 rounded-full blur-3xl dark:bg-purple-400" />
            </motion.div>

            <div className="w-full max-w-4xl mx-auto text-center relative z-10 px-6">
                <motion.div 
                    className="inline-block mb-6 md:mb-8"
                    variants={itemVariants}
                >
                    <div className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-full bg-gradient-to-r from-accent to-purple-500 dark:from-dark-accent dark:to-purple-400 p-1">
                        <div className="w-full h-full rounded-full bg-tertiary dark:bg-dark-tertiary flex items-center justify-center">
                            <span className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-purple-500 dark:from-dark-accent dark:to-purple-400">
                                VK
                            </span>
                        </div>
                    </div>
                </motion.div>

                <motion.h1 
                    className="text-4xl md:text-7xl font-bold mb-6 md:mb-8"
                    variants={textVariants}
                >
                    <span className="text-primary dark:text-dark-primary">Hi, I&apos;m</span>{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-500 dark:from-dark-accent dark:to-purple-400">
                        Vikram Kangotra
                    </span>
                </motion.h1>
                
                <motion.p 
                    className="text-base md:text-2xl text-secondary dark:text-dark-secondary mb-8 md:mb-12 max-w-2xl mx-auto"
                    variants={textVariants}
                >
                    A passionate developer crafting digital experiences with modern technologies and creative solutions
                </motion.p>

                <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto mb-8 md:mb-12"
                    variants={itemVariants}
                >
                    <motion.div 
                        className="group relative overflow-hidden rounded-2xl bg-quaternary dark:bg-dark-quaternary p-6 md:p-8 hover:shadow-xl transition-all duration-300"
                        whileHover={{ 
                            y: -5,
                            scale: 1.02,
                            transition: { type: "spring", stiffness: 400, damping: 10 }
                        }}
                    >
                        <h3 className="text-xl md:text-2xl font-bold text-primary dark:text-dark-primary mb-3 md:mb-4">Projects</h3>
                        <p className="text-base md:text-lg text-secondary dark:text-dark-secondary mb-4 md:mb-6">
                            Explore my latest projects and see how I bring ideas to life with code
                        </p>
                        <HeroButton link="/projects" bgColor="bg-accent" textColor="text-white">
                            View Projects
                        </HeroButton>
                    </motion.div>

                    <motion.div 
                        className="group relative overflow-hidden rounded-2xl bg-quaternary dark:bg-dark-quaternary p-6 md:p-8 hover:shadow-xl transition-all duration-300"
                        whileHover={{ 
                            y: -5,
                            scale: 1.02,
                            transition: { type: "spring", stiffness: 400, damping: 10 }
                        }}
                    >
                        <h3 className="text-xl md:text-2xl font-bold text-primary dark:text-dark-primary mb-3 md:mb-4">Blogs</h3>
                        <p className="text-base md:text-lg text-secondary dark:text-dark-secondary mb-4 md:mb-6">
                            Read my thoughts on technology, development, and more
                        </p>
                        <HeroButton link="/blogs" bgColor="bg-purple-500" textColor="text-white">
                            Read Blogs
                        </HeroButton>
                    </motion.div>
                </motion.div>

                <motion.div 
                    className="flex justify-center space-x-6"
                    variants={itemVariants}
                >
                    <a 
                        href="https://github.com/vikram-kangotra" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary dark:text-dark-primary hover:text-accent dark:hover:text-dark-accent transition-colors duration-300 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                    </a>
                    <a 
                        href="http://linkedin.com/in/vikram-kangotra-991352241" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary dark:text-dark-primary hover:text-accent dark:hover:text-dark-accent transition-colors duration-300 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                    </a>
                </motion.div>
            </div>
        </motion.div>
    );
}
