import Image from 'next/image';
import Link from 'next/link';

export default function BlogCard({blog}) {
    return (
        <Link href="#" className="flex flex-col items-center border rounded-lg shadow md:flex-row border-quaternary bg-slate-950 hover:bg-slate-800">
            <Image className="object-cover w-full rounded-t-lg h-96 md:h-auto md:w-72 md:rounded-none md:rounded-l-lg" src={blog.image} alt="" />
            <div className="flex flex-col justify-between p-4 leading-normal">
                <h5 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{blog.title}</h5>
                <p className="mb-3 font-normal text-gray-700 dark:text-gray-400">{blog.description}</p>
            </div>
        </Link>
    )
}
