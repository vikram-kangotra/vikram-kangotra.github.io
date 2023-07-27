import Image from 'next/image'
import Link from 'next/link'

export default function ProjectCard({href, imageSrc, projectName}) {
    return (
        <Link href={href}>
            <div className='relative overflow-hidden rounded-xl group md:rounded-3xl md:grayscale hover:grayscale-0 '>
                <span className={`absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 md:translate-y-full bg-black group-hover:translate-y-16 ease opacity-20 blur-2xl`}>
                </span>
                <span className={`absolute inset-0 flex items-center justify-center w-full h-full md:text-white duration-300 translate-y-5 md:translate-y-full md:group-hover:translate-y-0 ease text-lg md:text-4xl text-bold`}>
                    {projectName}
                </span>
                <Image src={imageSrc} alt="project image" />
            </div>
        </Link>
    )
}
