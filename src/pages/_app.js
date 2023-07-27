import Footer from '@/components/footer'
import '@/styles/globals.css'
import {useEffect, useRef, useState} from 'react';
import TOPOLOGY from 'vanta/dist/vanta.topology.min';

export default function App({ Component, pageProps }) {

    const vantaRef = useRef(null);
    const [vantaEffect, setVantaEffect] = useState(0);

    useEffect(() => {

        const THREE = require("three");
        const p5 = require("p5");

        if (!vantaEffect) {
            setVantaEffect(
                TOPOLOGY({
                  el: vantaRef.current,
                  p5: p5,
                  THREE: THREE,
                  mouseControls: true,
                  touchControls: true,
                  gyroControls: false,
                  minHeight: 200.00,
                  minWidth: 200.00,
                  scale: 1.00,
                  scaleMobile: 1.00,
                  color: 0x5086e,
                  backgroundColor: 0x000
                })
            );
        }
        return () => {
            if (vantaEffect) vantaEffect.destroy()
        }
    }, [vantaEffect])

  return (
      <div ref={vantaRef}>
          <Head>
            <title>Vikram Kangotra</title>
            <meta name="description" content="Vikram Kangotra's personal website" />
            <meta name="google-site-verification" content="nWHT--ANnA0sf0jq0z-R3ou6RtZRUAQD0H0goY5Hvck" />
          </Head>
          <Component {...pageProps} />
          <Footer />
      </div>
  )
}
