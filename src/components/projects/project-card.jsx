import Image from 'next/image';
import Link from 'next/link';

export default function ProjectCard({ project }) {
    let { name, description, href, imageSrc } = project;

    return (
        <Link href={href} className="transition-transform duration-500 ease-in-out transform hover:scale-105">
            <div className='relative flex items-center h-full overflow-hidden border border-quaternary rounded-xl group md:rounded-3xl'>
                <span className='absolute inset-0 opacity-50 bg-gradient-to-t from-black via-transparent to-transparent md:opacity-30 group-hover:opacity-40 transition-opacity duration-300'/>
                <span className='absolute inset-0 flex items-center justify-center w-full h-full text-white bg-slate-950 bg-opacity-10 md:bg-opacity-5 group-hover:bg-opacity-20 transition-all duration-300 ease-out blur-2xl'/>
                <span className='absolute bottom-0 w-full p-4 text-white md:p-6 transition-transform duration-300 transform translate-y-5 md:translate-y-full group-hover:translate-y-0 bg-slate-950 bg-opacity-60'>
                    <div className='flex flex-col items-center justify-center'>
                        <div className="text-2xl font-bold md:text-4xl">{name}</div>
                        <div className="my-2 text-sm text-center opacity-80 md:text-base">{description}</div>
                    </div>
                </span>
                <Image src={imageSrc} alt="project image" className="object-cover w-full h-full" />
            </div>
        </Link>
    )
}

