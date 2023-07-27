import Image from 'next/image'
import Link from 'next/link'

export default function ProjectCard({href, imageSrc, projectName}) {
    return (
        <Link href={href}>
            <div className='relative overflow-hidden group rounded-3xl grayscale hover:grayscale-0 '>
                <span className={`absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 translate-y-full bg-black group-hover:translate-y-16 ease opacity-20 blur-2xl`}>
                </span>
                <span className={`absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 translate-y-full group-hover:translate-y-0 ease text-4xl text-left text-bold`}>
                    {projectName}
                </span>
                <Image src={imageSrc} alt="project image" />
            </div>
        </Link>
    )
}
