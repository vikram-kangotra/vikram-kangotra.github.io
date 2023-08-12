import Image from 'next/image'
import { Syne } from 'next/font/google'

const syne = Syne({ subsets: ['latin'], weights: ['400', '700'] })

export default function InterestCard({heading, subheading, imageSrc, className}) {
    return (
        <div className={`flex flex-col content-start items-start p-8 bg-slate-950 overflow-visible justify-start justify-self-center content-start flex-nowrap self-center rounded-lg gap-5 h-full border border-quaternary ${className}`}>
            <div className='flex flex-col items-start justify-center align-start conetnt-start flex-nowrap gap-1'>
                <h1 className={`font-bold text-3xl ${syne.className}`}>{heading}</h1>
                <h2 className='text-base font-medium leading-tight text-left opacity-70'>{subheading}</h2>
            </div>
            <Image className='object-cover overflow-hidden rounded-lg' src={imageSrc} alt={heading} />
        </div>
    )
}
