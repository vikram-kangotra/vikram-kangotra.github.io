import Image from 'next/image';
import Link from 'next/link';

export default function BlogCard({blog}) {
    return (
        <Link href="#" className="flex flex-col items-center border rounded-lg shadow md:flex-row border-quaternary bg-slate-950 hover:bg-slate-900">
            <Image className="object-cover w-full rounded-t-lg h-60 md:h-auto md:w-52 md:rounded-none md:rounded-l-lg" src={blog.image} alt="" />
            <div className="flex flex-col justify-between p-4 leading-normal">
                <h5 className="mb-2 text-lg font-semibold tracking-tight text-gray-900 md:text-xl dark:text-white">{blog.title}</h5>
                <p className="mb-3 text-sm font-normal text-gray-700 md:text-base dark:text-gray-400">{blog.description}</p>
            </div>
        </Link>
    )
}
