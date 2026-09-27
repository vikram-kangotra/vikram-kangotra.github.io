import { getAllBlogs } from '@/utils/mdx';
import { SEO, Eyebrow } from '@/components/ui';
import Explorer from '@/components/blogs/Explorer';
export default function Writing({ blogs }) {
  return (
    <div className="shell writing-home">
      <SEO
        title="Writing — Vikram Kangotra"
        description="Explore notes on Rust, WebAssembly, open source, and the journey of learning by building."
        path="/blogs"
      />
      <div className="writing-intro">
        <Eyebrow>THE COMPLETE NOTEBOOK</Eyebrow>
        <h1>Pick a rabbit hole.</h1>
        <p>
          Stories from the workbench. Lessons from open source.
          <br />
          Find your next read, or come back to one you saved.
        </p>
      </div>
      <Explorer blogs={blogs} />
    </div>
  );
}
export async function getStaticProps() {
  return { props: { blogs: await getAllBlogs() } };
}
