import Footer from '@/components/footer'
import Navbar from '@/components/navbar';
import '@/styles/globals.css'
import {useRouter} from 'next/router';
import { ThemeProvider } from '@/context/ThemeContext';

import "@/styles/code-theme.css";
import "@/styles/custom-code-theme.css";
import "@/styles/code-line-number.css";
import {useEffect} from 'react';

export default function App({ Component, pageProps }) {
    const router = useRouter();
    const isHomePage = router.pathname == '/';

    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://www.googletagmanager.com/gtag/js?id=G-1FQ468YY1J";
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.dataLayer = window.dataLayer || [];
            function gtag(){
                dataLayer.push(arguments)
            }
            gtag('js', new Date());
            gtag('config', 'G-1FQ468YY1J');
        }
    }, []);

    return (
        <ThemeProvider>
            <div className="min-h-screen">
                { !isHomePage && (<Navbar />) }
                <Component {...pageProps} />
                <Footer />
            </div>
        </ThemeProvider>
    )
}
