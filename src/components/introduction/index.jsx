import Link from "next/link"
import { motion } from "framer-motion"

export default function Introduction() {
    return (
        <div className="flex flex-col items-center justify-start p-6 md:p-10 bg-white dark:bg-dark-tertiary">
            <div className="relative flex flex-col items-center justify-start max-w-4xl w-full">
                {/* Animated background elements */}
                <motion.div 
                    className="absolute w-32 h-32 md:w-64 md:h-64 bg-accent rounded-full left-0 md:left-24 top-8 opacity-10 blur-3xl"
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div 
                    className="absolute w-32 h-32 md:w-64 md:h-64 bg-purple-500 rounded-full right-0 md:-right-24 bottom-8 opacity-10 blur-3xl"
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, -5, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />

                <div className="pt-6 my-auto text-center space-y-6 w-full">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="w-full"
                    >
                        <h2 className="mb-3 text-3xl md:text-4xl font-bold tracking-tight text-primary dark:text-dark-primary">
                            Crafting Digital Experiences
                        </h2>
                        <p className="text-xl md:text-2xl text-secondary dark:text-dark-secondary max-w-2xl mx-auto">
                            Transforming ideas into elegant solutions through code and creativity.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="max-w-2xl mx-auto"
                    >
                        <p className="py-3 text-lg md:text-xl text-secondary dark:text-dark-secondary leading-relaxed">
                            As a software developer, I blend technical expertise with creative problem-solving. 
                            My passion for Linux and open-source drives my continuous exploration of new technologies.
                            <br/><br/>
                            When I&apos;m not building applications, you might find me{" "}
                            <span className="relative inline-flex items-center">
                                <del className="px-1 text-white line-through bg-red-500/80 dark:bg-red-600/80 rounded">break</del>
                                <ins className="px-1 text-white bg-accent dark:bg-dark-accent rounded ml-1">tinker</ins>
                            </span>{" "}
                            with my Linux setup or sharing my experiences through writing.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <figcaption className="font-medium">
                            <div className="text-2xl font-bold text-accent dark:text-dark-accent mb-2">
                                Vikram Kangotra
                            </div>
                            <div className="text-secondary dark:text-dark-secondary">
                                Building the future, one line of code at a time{" "}
                                <Link 
                                    href="https://github.com/vikram-kangotra" 
                                    className="text-accent dark:text-dark-accent hover:underline transition-colors duration-300"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    on GitHub
                                </Link>
                            </div>
                        </figcaption>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
