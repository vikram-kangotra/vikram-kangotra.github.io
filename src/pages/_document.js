import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
    static async getInitialProps(ctx) {
        const initialProps = await Document.getInitialProps(ctx)
        return { ...initialProps }
    }

    render() {
        return (
            <Html lang="en">
                <Head>
                    <meta name="google-site-verification" content="mfXmatB1-JrCwUSXz5TVVuR5zK5cn0N9-QzpM87jtgs" />
                    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                    <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        )
    }
}

export default MyDocument
