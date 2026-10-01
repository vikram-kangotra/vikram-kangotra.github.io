import { ReadingProvider } from '@/context/ReadingContext';
import Footer from '@/components/footer';
import Navbar from '@/components/navbar';
import { ThemeProvider } from '@/context/ThemeContext';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import '@/styles/globals.css';
import '@/styles/code-theme.css';
import '@/styles/custom-code-theme.css';
import '@/styles/code-line-number.css';
export default function App({ Component, pageProps }) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  useEffect(() => {
    // Keep local development and preview visits out of production analytics.
    setAnalyticsEnabled(process.env.NODE_ENV === 'production' && window.location.hostname === 'vikram-kangotra.github.io');
  }, []);
  return (
    <ThemeProvider>
      <ReadingProvider>
        {Component.coursePage ? <Component {...pageProps} /> : <>
          <a className="skip-link" href="#main-content">Skip to content</a>
          <Navbar blogs={pageProps.blogs || pageProps.allBlogs || []} />
          <main id="main-content" tabIndex={-1}><Component {...pageProps} /></main>
          <Footer />
        </>}
        {analyticsEnabled && <>
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-1FQ468YY1J"
            strategy="afterInteractive"
          />
          <Script
            id="analytics"
            strategy="afterInteractive"
          >{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-1FQ468YY1J');`}</Script>
        </>}
      </ReadingProvider>
    </ThemeProvider>
  );
}
