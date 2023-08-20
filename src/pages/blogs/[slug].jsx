import React from "react";
import Head from "next/head";
import Image from "next/image";
import rehypeCodeTitles from "rehype-code-titles";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { getBlogFromSlug, getSlug } from "@/utils/mdx";
import { serialize } from "next-mdx-remote/serialize";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import dayjs from "dayjs";
import {MDXRemote} from "next-mdx-remote";
import { League_Spartan } from "next/font/google";

const league_spartan = League_Spartan({ subsets: ['latin'], weights: ['400', '700'] })

export default function Blog({ post: {source, frontmatter} }) {

    return (
        <React.Fragment>
            <Head>
                <title>{frontmatter.title} | My blog</title>
            </Head>
            <div className="flex flex-col items-center content-center p-10 overflow-hidden flex-nowrap">
                <div className="max-w-4xl">
                    <header className="mb-4 lg:mb-6 not-format">
                        <h1 className="mb-4 text-3xl font-extrabold leading-tight text-gray-900 lg:mb-6 lg:text-4xl dark:text-white">{frontmatter.title}</h1>
                        <address className="flex items-center mb-6 not-italic">
                            <div className="inline-flex items-center mr-3 text-sm text-gray-900 dark:text-white">
                                <div>
                                    <p className="text-base font-light text-gray-500 dark:text-gray-400">
                                      {dayjs(frontmatter.publishedAt).format('MMMM D, YYYY')} &mdash;{' '}
                                      {frontmatter.readingTime}
                                    </p>
                                </div>
                            </div>
                        </address>
                    </header>

                    <article className={`font-sans text-white max-w-none md:prose-lg lg:prose-xl prose dark:prose-invert ${league_spartan.className}`}>
                      <MDXRemote {...source} components={{ Image }} />
                    </article>
                </div>
            </div>
        </React.Fragment>
    )
}

export async function getStaticPaths() {
    const paths = (await getSlug()).map((slug) => ({ params: { slug } }))

    return {
        paths,
        fallback: false,
    }
}


export async function getStaticProps({params}) {
    const { slug } = params;
    const { content, frontmatter } = await getBlogFromSlug(slug);

    const mdxSource = await serialize(content, {
        mdxOptions: {
            rehypePlugins: [
                rehypeSlug,
                [
                    rehypeAutolinkHeadings,
                    {
                        properties: { className: ["anchor"] },
                    },
                    {
                        behavior: "wrap",
                    },
                ],
                rehypeHighlight,
                rehypeCodeTitles,
            ],
        }
    });

    return {
        props: {
            post: {
                source: mdxSource,
                frontmatter,
            }
        }
    }
}
