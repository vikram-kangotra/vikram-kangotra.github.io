import Footer from '@/components/footer'
import Navbar from '@/components/navbar';
import '@/styles/globals.css'
import {useRouter} from 'next/router';
import Particles from 'react-particles'
import { loadFull } from 'tsparticles'

import "../styles/code-theme.css";
import "../styles/custom-code-theme.css";
import "../styles/code-line-number.css";

const options = {
    background: {
        color: {
            value: "#001",
        },
    },
    fpsLimit: 120,
    interactivity: {
        events: {
            onClick: {
                enable: true,
                mode: "grab",
            },
            onHover: {
                enable: true,
                mode: "grab",
            },
            resize: true,
        },
        modes: {
            grab: {
                distance: 200,
                links: {
                    opacity: 0.3,
                },
            },
        },
    },
    particles: {
        color: {
            value: "#ffffff",
        },
        move: {
            direction: "none",
            enable: true,
            outModes: {
                default: "bounce",
            },
            random: false,
            speed: 6,
            straight: false,
        },
        number: {
            density: {
                enable: true,
                area: 800,
            },
            value: 80,
        },
        opacity: {
            value: 0.1,
        },
        shape: {
            type: "circle",
        },
        size: {
            value: { min: 1, max: 5 },
        },
    },
    detectRetina: true,
};

export default function App({ Component, pageProps }) {

    const particlesInit = async (main) => {
        await loadFull(main);
    }

    const router = useRouter();
    const isHomePage = router.pathname == '/';

    return (
        <div>
            <Particles init={particlesInit} options={options} />
            <div className='relative'>
                { !isHomePage && (<Navbar />) }
                <Component {...pageProps} />
            </div>
            <Footer />
        </div>
    )
}
