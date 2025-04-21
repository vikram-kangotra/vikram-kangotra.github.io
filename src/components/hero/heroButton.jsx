import Link from "next/link";
import { motion } from "framer-motion";

export default function HeroButton({ link, bgColor, textColor, children }) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            <Link 
                href={link} 
                className={`
                    relative inline-flex items-center justify-center 
                    px-6 py-3 overflow-hidden font-medium 
                    transition-all duration-300 ease-out 
                    rounded-full shadow-lg
                    ${bgColor} ${textColor}
                    hover:shadow-xl
                    border-2 border-gray-200 dark:border-gray-700
                    hover:border-accent dark:hover:border-dark-accent
                `}
            >
                <span className="relative z-10 flex items-center">
                    {children}
                    <svg 
                        className="w-5 h-5 ml-2" 
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
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-accent to-purple-500 dark:from-dark-accent dark:to-purple-400 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-full" />
            </Link>
        </motion.div>
    );
}
