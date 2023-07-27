import Link from "next/link";

export default function Blogs() {
    return (
        <div className="flex flex-col items-center justify-start p-20 overflow-hidden">
            <div className="flex flex-col items-start content-start justify-start max-w-4xl overflow-visible gap-5 min-h-max">
                <p className="text-lg font-medium opacity-60">Blogs (WIP: Coming Soon. Stay tuned)</p>
                <p className="w-full text-base text-right text-gray-500 dark:text-gray-400">
                    You can&apos;t miss reading rest of the blogs.
                    <Link href="#" className="inline-flex items-center font-medium text-blue-600 dark:text-blue-500 hover:underline">
                        Read all blogs
                        <svg className="w-4 h-4 ml-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                        </svg>
                    </Link> 
                </p>
            </div>
        </div>
    )
}
