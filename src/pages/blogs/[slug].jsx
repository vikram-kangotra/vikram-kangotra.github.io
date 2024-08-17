import React, {useEffect, useState} from "react";
import Head from "next/head";
import Image from "next/image";
import rehypeCodeTitles from "rehype-code-titles";
import rehypePrism from "rehype-prism-plus";
import rehypeSlug from "rehype-slug";
import { getBlogFromSlug, getSlug } from "@/utils/mdx";
import { serialize } from "next-mdx-remote/serialize";
import dayjs from "dayjs";
import {MDXRemote} from "next-mdx-remote";
import Link from "next/link";
import CustomLink from "@/components/customlink";

function Previous({link}) {

    if (link === null) {
        return <></>;
    }

    return (
        <Link href={link} className="flex justify-center w-full h-20 border rounded-lg md:flex-col md:h-32 group md:text-2xl border-violet-400 border-opacity-60 md:border-opacity-0 hover:border-opacity-60 transition duration-500">
            <div className="flex items-center justify-center">
                <span className="md:opacity-0 group-hover:visible group-hover:opacity-80 transition duration-300 delay-200">&lt;</span>
                <span className="md:opacity-0 group-hover:visible group-hover:opacity-90 transition duration-300 delay-100">&lt;</span>
                <span className="md:opacity-0 group-hover:visible group-hover:opacity-100 transition duration-300">&lt;&nbsp;</span>
                <div className="font-bold">Previous</div>
            </div>
            <div className="justify-center hidden text-base md:flex">
                {link}
            </div>
        </Link>
    )
}

function Next({link}) {

    if (link === null) {
        return <></>;
    }

    return (
        <Link href={link} className="flex justify-center w-full h-20 border rounded-lg md:flex-col md:h-32 group md:text-2xl border-violet-400 border-opacity-60 md:border-opacity-0 hover:border-opacity-60 transition duration-500">
            <div className="flex items-center justify-center">
                <div className="font-bold">Next</div>
                <span className="md:opacity-0 group-hover:visible group-hover:opacity-100 transition duration-300 ">&nbsp;&gt;</span>
                <span className="md:opacity-0 group-hover:visible group-hover:opacity-90 transition duration-300 delay-100">&gt;</span>
                <span className="md:opacity-0 group-hover:visible group-hover:opacity-80 transition duration-300 delay-200">&gt;</span>
            </div>
            <div className="justify-center hidden text-base md:flex">
                {link}
            </div>
        </Link>
    )
}

export default function Blog({ post: {source, frontmatter}, previous, next }) {

    const [date, setDate] = useState(null);

    useEffect(() => {
        setDate(dayjs(frontmatter.publishedAt).format('MMMM D, YYYY'));
    }, [frontmatter.publishedAt]);

    return (
        <>
            <Head>
                <title>{frontmatter.title}</title>
            </Head>
            <div className="flex flex-col p-10 md:items-center">
                <div className="max-w-4xl lg:max-w-5xl">
                    <header className="mb-4 lg:mb-6 not-format">
                        <h1 className="mb-4 text-3xl font-bold leading-tight text-white lg:mb-6 lg:text-4xl">{frontmatter.title}</h1>
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

                    <article className={`text-white max-w-none md:prose-md lg:prose-lg prose text-lg prose-invert font-normal font-sans`}>
                      <MDXRemote {...source} components={{ Image, a: CustomLink }} />
                    </article>
                    
                    <div className="flex h-32 my-10 text-pink-500 gap-1">
                        <Previous link={previous}/>
                        <Next link={next}/>
                    </div>
                </div>
            </div>
        </>
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
                rehypePrism,
                rehypeCodeTitles,
            ],
        }
    });

    const paths = await getSlug();
    const index = paths.findIndex((p) => p == slug);

    const next = index == 0 ? null : paths[index - 1];
    const previous = index == paths.length - 1 ? null : paths[index + 1];

    return {
        props: {
            post: {
                source: mdxSource,
                frontmatter,
            },
            previous,
            next,
        }
    }
}
