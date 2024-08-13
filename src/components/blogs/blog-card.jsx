import Link from 'next/link';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

export default function BlogCard({ blog }) {
    const [date, setDate] = useState(null);

    useEffect(() => {
        setDate(dayjs(blog.publishedAt).format('MMMM D, YYYY'));
    }, [blog.publishedAt]);

    return (
        <Link href={`/blogs/${blog.slug}`} className="flex flex-col items-center bg-black border rounded-lg shadow-2xl shadow-blue-500/20 md:flex-row border-quaternary group">
            <div className="flex flex-col justify-between p-6 leading-normal">
                <h5 className="mb-3 text-xl font-semibold tracking-tight text-white group-hover:text-purple-400 transition duration-300">{blog.title}</h5>
                <p className="mb-2 text-sm italic font-light text-gray-400">
                    {date} &mdash; {blog.readingTime}
                </p>
                <p className="mb-4 text-base font-medium text-gray-300">{blog.excerpt}</p>
                <p className="text-white">
                    Read more{' '}
                    <span className='font-extrabold opacity-0 text-1xl transition duration-300 group-hover:text-purple-500 group-hover:opacity-100'>&gt;</span>
                    <span className='font-extrabold opacity-0 transition duration-300 group-hover:text-purple-500 delay-100 group-hover:opacity-90'>&gt;</span>
                    <span className='font-extrabold opacity-0 transition duration-300 group-hover:text-purple-500 delay-200 group-hover:opacity-70'>&gt;</span>
                </p>
            </div>
        </Link>
    );
}

