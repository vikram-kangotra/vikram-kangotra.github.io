import Link from 'next/link';
export default function CustomLink({ href, children, ...props }) {
  const external = /^https?:\/\//.test(href || '');
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ) : (
    <Link href={href || '#'} {...props}>
      {children}
    </Link>
  );
}
