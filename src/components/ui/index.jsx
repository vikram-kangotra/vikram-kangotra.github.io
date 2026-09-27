import Head from 'next/head';
export function Arrow({ diagonal = false, ...props }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      {diagonal ? <path d="M5 19 19 5M5 5h14v14" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
    </svg>
  );
}
export function SEO({
  title = 'Vikram Kangotra — Software engineer & open-source builder',
  description = 'I build compilers, explore operating systems, and contribute to open source. Projects and field notes on Rust, WebAssembly, Linux, and the things underneath.',
  path = '/',
}) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={`https://vikram-kangotra.github.io${path}`} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`https://vikram-kangotra.github.io${path}`} />
      <meta name="twitter:card" content="summary" />
    </Head>
  );
}
export function Eyebrow({ children }) {
  return <p className="eyebrow">{children}</p>;
}
