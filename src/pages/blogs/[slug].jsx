import React, {useEffect, useState} from "react";
import Head from "next/head";
import Image from "next/image";
import rehypeCodeTitles from "rehype-code-titles";
import rehypeHighlight from "rehype-highlight";
import rehypePrism from "rehype-prism-plus";
import rehypeSlug from "rehype-slug";
import { getBlogFromSlug, getSlug } from "@/utils/mdx";
import { serialize } from "next-mdx-remote/serialize";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import dayjs from "dayjs";
import {MDXRemote} from "next-mdx-remote";
import localFont from "@next/font/local";

const noirpro = localFont({
    src: [
        {
            path: '../../assets/noirpro/NoirPro-Regular.otf',
            weight: '400',
        },
    ],
    variable: '--font-niorpro',
});

export default function Blog({ post: {source, frontmatter} }) {

    const [date, setDate] = useState(null);

    useEffect(() => {
        setDate(dayjs(frontmatter.publishedAt).format('MMMM D, YYYY'));
    }, []);

    return (
        <React.Fragment>
            <Head>
                <title>{frontmatter.title}</title>
            </Head>
            <div className="flex flex-col p-10 md:items-center">
                <div className="max-w-4xl">
                    <header className="mb-4 lg:mb-6 not-format">
                        <h1 className="mb-4 text-3xl font-extrabold leading-tight text-white lg:mb-6 lg:text-4xl ${noirpro.variable}">{frontmatter.title}</h1>
                        <address className="flex items-center mb-6 not-italic">
                            <div className="inline-flex items-center mr-3 text-sm text-white">
                                <div>
                                    <p className="text-base font-light text-gray-400">
                                      {date} &mdash;{' '}
                                      {frontmatter.readingTime}
                                    </p>
                                </div>
                            </div>
                        </address>
                    </header>

                    <article className={`font-sans text-white max-w-none md:prose-md lg:prose-lg prose dark:prose-invert ${noirpro.variable}`}>
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
                rehypePrism,
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
