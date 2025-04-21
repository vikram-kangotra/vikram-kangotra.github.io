import { useTheme } from '@/context/ThemeContext';
import { BsMoonStars, BsSun } from 'react-icons/bs';
import { motion, AnimatePresence } from 'framer-motion';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <motion.button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={theme}
                    initial={{ rotate: -180, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 180, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                    {theme === 'light' ? (
                        <BsMoonStars className="w-5 h-5 text-gray-800" />
                    ) : (
                        <BsSun className="w-5 h-5 text-yellow-400" />
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.button>
    );
} 