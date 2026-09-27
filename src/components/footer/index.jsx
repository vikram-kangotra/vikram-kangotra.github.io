import Link from 'next/link';
import { Arrow } from '@/components/ui';
export default function Footer() {
  return (
    <footer className="shell footer">
      <div className="footer-top">
        <div>
          <p className="eyebrow">GOOD THINGS START WITH A CONVERSATION</p>
          <h2>Have something in mind?</h2>
          <a className="contact-link" href="mailto:vikramkangotra8055@gmail.com">
            Let’s build something. <Arrow diagonal />
          </a>
        </div>
        <div className="footer-social">
          <a href="https://github.com/vikram-kangotra" target="_blank" rel="noopener noreferrer">
            GitHub <Arrow diagonal />
          </a>
          <a
            href="https://www.linkedin.com/in/vikram-kangotra-991352241/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn <Arrow diagonal />
          </a>
          <a href="mailto:vikramkangotra8055@gmail.com">
            Email <Arrow diagonal />
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <Link href="/">© {new Date().getFullYear()} Vikram Kangotra</Link>
        <span>Built with curiosity. Shared with the world.</span>
        <a href="#main-content">Back to top ↑</a>
      </div>
    </footer>
  );
}
