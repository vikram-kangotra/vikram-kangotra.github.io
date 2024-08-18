import Image from 'next/image'
import Link from 'next/link'

export default function ProjectCard({project}) {

    let {name, description, href, imageSrc} = project;

    return (
        <Link href={href} className="transition-transform duration-500 ease-in-out transform hover:scale-100 scale-90">
            <div className='relative flex items-center h-full overflow-hidden border border-quaternary rounded-xl group md:rounded-3xl '>
                <span className='absolute inset-0 opacity-50 bg-slate-950 md:translate-y-0 translate-y-full group-hover:translate-y-full'/>
                <span className={`absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 md:translate-y-full bg-slate-950 group-hover:translate-y-16 ease opacity-20 blur-2xl`}>
                </span>
                <span className='absolute bottom-0 w-full p-4 md:p-6 md:text-white duration-300 translate-y-5 md:translate-y-96 md:group-hover:translate-y-0 ease bg-slate-950 bg-opacity-40'>
                    <div className='flex flex-col items-center justify-center'>
                        <div className="text-2xl md:text-4xl text-bold">{name}</div>
                        <div className="my-2 text-sm text-center opacity-75 md:text-base">{description}</div>
                    </div>
                </span>
                <Image src={imageSrc} alt="project image" />
            </div>
        </Link>
    )
}
