import Link from 'next/link';
import dayjs from 'dayjs';
import {useEffect, useState} from 'react';

export default function BlogCard({blog}) {

    const [date, setDate] = useState(null);

    useEffect(() => {
        setDate(dayjs(blog.publishedAt).format('MMMM D, YYYY'));
    }, []);

    return (
        <Link href={`/blogs/${blog.slug}`} className="flex flex-col items-center border rounded-lg shadow md:flex-row border-quaternary bg-slate-950 group">
            <div className="flex flex-col justify-between p-4 leading-normal">
                <h5 className="mb-2 text-lg font-semibold tracking-tight text-white text-gray-900 group-hover:text-purple-400 md:text-xl transition duration-300">{blog.title}</h5>
                    <p className="text-base italic font-light text-gray-500 dark:text-gray-400">
                      {date} &mdash;{' '}
                      {blog.readingTime}
                    </p>
                <p className="mb-3 text-base font-normal text-gray-300">{blog.excerpt}</p>
                <p className='text-white'>
                    Read more <span className='font-extrabold opacity-0 text-1xl transition duration-300 group-hover:text-purple-500 group-hover:opacity-100'>&gt;</span>
                    <span className='font-extrabold opacity-0 transition duration-300 group-hover:text-purple-500 delay-100 group-hover:opacity-90'>&gt;</span>
                    <span className='font-extrabold opacity-0 transition duration-300 group-hover:text-purple-500 delay-200 group-hover:opacity-70'>&gt;</span>
                </p>
            </div>
        </Link>
    )
}
