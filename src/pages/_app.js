import Footer from '@/components/footer'
import Navbar from '@/components/navbar';
import '@/styles/globals.css'
import {useRouter} from 'next/router';
import Particles from 'react-particles'
import { loadFull } from 'tsparticles'

import "../styles/code-theme.css";
import "../styles/custom-code-theme.css";
import "../styles/code-line-number.css";
import {useEffect} from 'react';

const options = {
    particles: {
        number: {
            value: 60,
            density: {
                enable: true,
                area: 800,
            }
        },
        line_linked: {
            enable: true,
            opacity: 0.2
        },
        move: {
            direction: "right",
            speed: 0.5
        },
        size: {
            value: 1,
        },
        shape: {
            type: "star",
            stroke: {
                width: 1,
                color: "#000000"
            }
        },
        opacity: {
            anim: {
                enable: true,
                speed: 1,
                opacity_min: 0.05
            }
        }
    },
    interactivity: {
        events: {
            onhover: {
                enable: true,
                mode: "grab"
            },
        },
    },
    retina_detect: true
};

export default function App({ Component, pageProps }) {

    const particlesInit = async (main) => {
        await loadFull(main);
    }

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
        <>
            <Particles init={particlesInit} options={options} />
            <div>
            { !isHomePage && (<Navbar />) }
            <Component {...pageProps} />
            </div>
            <Footer />
        </>
    )
}
