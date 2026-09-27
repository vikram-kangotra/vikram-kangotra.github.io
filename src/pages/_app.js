import { ReadingProvider } from '@/context/ReadingContext';
import Footer from '@/components/footer';
import Navbar from '@/components/navbar';
import { ThemeProvider } from '@/context/ThemeContext';
import Script from 'next/script';
import '@/styles/globals.css';
import '@/styles/code-theme.css';
import '@/styles/custom-code-theme.css';
import '@/styles/code-line-number.css';
export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <ReadingProvider>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Navbar blogs={pageProps.blogs || pageProps.allBlogs || []} />
        <main id="main-content" tabIndex={-1}>
          <Component {...pageProps} />
        </main>
        <Footer />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1FQ468YY1J"
          strategy="afterInteractive"
        />
        <Script
          id="analytics"
          strategy="afterInteractive"
        >{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-1FQ468YY1J');`}</Script>
      </ReadingProvider>
    </ThemeProvider>
  );
}
