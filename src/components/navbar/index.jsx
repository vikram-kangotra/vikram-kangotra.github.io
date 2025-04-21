import Link from "next/link";
import { useRouter } from "next/router";
import Logo from "../logo";
import { useState, useEffect } from "react";
import ThemeToggle from '@/components/ThemeToggle';
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    // Close menu when route changes
    useEffect(() => {
        const handleRouteChange = () => {
            setIsMenuOpen(false);
        };

        router.events.on('routeChangeStart', handleRouteChange);
        return () => {
            router.events.off('routeChangeStart', handleRouteChange);
        };
    }, [router]);

    return ( 
        <nav className="sticky top-0 z-50 bg-white/80 dark:bg-dark-tertiary/80 backdrop-blur-md shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center">
                            <Logo />
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex md:items-center md:space-x-8">
                        <button 
                            className="px-5 py-2 rounded-full border border-gray-200 dark:border-gray-700 hover:border-accent dark:hover:border-dark-accent text-gray-700 dark:text-dark-primary hover:text-accent dark:hover:text-dark-accent flex items-center gap-2 transition-all duration-300 hover:shadow-md"
                            onClick={() => router.back() }
                        > 
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062A1.125 1.125 0 0121 8.688v8.123zM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953L9.567 7.71a1.125 1.125 0 011.683.977v8.123z" />
                            </svg>
                            <span>Back</span>
                        </button>
                        <Link href="/" className="text-gray-700 dark:text-dark-primary hover:text-purple-500 dark:hover:text-purple-400 transition-colors duration-200">
                            Home
                        </Link>
                        <Link href="/blogs" className="text-gray-700 dark:text-dark-primary hover:text-purple-500 dark:hover:text-purple-400 transition-colors duration-200">
                            Blogs
                        </Link>
                        <Link href="/projects" className="text-gray-700 dark:text-dark-primary hover:text-purple-500 dark:hover:text-purple-400 transition-colors duration-200">
                            Projects
                        </Link>
                        <ThemeToggle />
                    </div>

                    {/* Mobile Navigation */}
                    <div className="flex items-center space-x-4 md:hidden">
                        <ThemeToggle />
                        <button 
                            onClick={toggleMenu}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-dark-primary hover:text-purple-500 dark:hover:text-purple-400 focus:outline-none transition-colors duration-200"
                            aria-label="Toggle menu"
                            aria-expanded={isMenuOpen}
                        >
                            <motion.div
                                animate={isMenuOpen ? "open" : "closed"}
                                variants={{
                                    closed: { rotate: 0 },
                                    open: { rotate: 180 }
                                }}
                                transition={{ duration: 0.2 }}
                            >
                                <svg 
                                    className="w-6 h-6" 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                >
                                    {isMenuOpen ? (
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M6 18L18 6M6 6l12 12" 
                                        />
                                    ) : (
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M4 6h16M4 12h16M4 18h16" 
                                        />
                                    )}
                                </svg>
                            </motion.div>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="md:hidden"
                        >
                            <div className="px-4 py-3 space-y-3 bg-white/80 dark:bg-dark-tertiary/80 backdrop-blur-md rounded-lg shadow-lg">
                                <button 
                                    className="w-full px-4 py-2 text-left flex items-center space-x-2 text-gray-700 dark:text-dark-primary hover:text-accent dark:hover:text-dark-accent rounded-lg transition-colors duration-200"
                                    onClick={() => router.back()}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062A1.125 1.125 0 0121 8.688v8.123zM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953L9.567 7.71a1.125 1.125 0 011.683.977v8.123z" />
                                    </svg>
                                    <span>Back</span>
                                </button>
                                <Link 
                                    href="/" 
                                    className="block px-4 py-2 text-gray-700 dark:text-dark-primary hover:bg-purple-500 dark:hover:bg-purple-600 rounded-lg transition-colors duration-200"
                                >
                                    Home
                                </Link>
                                <Link 
                                    href="/blogs" 
                                    className="block px-4 py-2 text-gray-700 dark:text-dark-primary hover:bg-purple-500 dark:hover:bg-purple-600 rounded-lg transition-colors duration-200"
                                >
                                    Blogs
                                </Link>
                                <Link 
                                    href="/projects" 
                                    className="block px-4 py-2 text-gray-700 dark:text-dark-primary hover:bg-purple-500 dark:hover:bg-purple-600 rounded-lg transition-colors duration-200"
                                >
                                    Projects
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </nav>
    );
}

