import { Syne } from "next/font/google"
import Link from "next/link"

const syne = Syne({ subsets: ['latin'], weights: ['400', '700'] })

export default function Introduction() {
    return (
        <div className="flex flex-col items-center justify-start p-10 overflow-hidden">
            <div className="z-10 flex flex-col items-start content-start justify-start max-w-4xl">
                <div className="pt-6 my-auto text-center space-y-4">
                    <div>
                        <p className="mb-3 text-xl font-semibold tracking-wide text-gray-700 md:text-3xl dark:text-gray-200">
                            Greetings, tech adventurer! <br/>Welcome to my domain where coding and Linux collide.</p>
                        <p className="py-3 italic font-medium tracking-wide text-md md:text-lg opacity-90">
                            I&apos;m a software developer fueled by a love for coding and Linux. 
                            <br/>Every now and then I <del className="px-1 text-white line-through bg-red-600 dark:bg-red-600"> break</del> <ins className="px-1 text-white bg-blue-800 dark:bg-blue-600"> tinker</ins> my linux machine. <br/> Sharing experiences and insights through writing.
                        </p>
                    </div>
                    <figcaption className="font-medium">
                        <div className="text-sky-800 dark:text-sky-400">
                            Vikram Kangotra
                        </div>
                        <div>
                            Student at <Link href="https://nitsri.ac.in/" className="hover:underline">NIT Srinagar</Link>
                        </div>
                    </figcaption>
                </div>
            </div>
        </div>
    )
}
