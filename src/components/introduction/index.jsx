import Link from "next/link"

export default function Introduction() {
    return (
        <div className="flex flex-col items-center justify-start p-10 overflow-hidden">
            <div className="relative flex flex-col items-start content-start justify-start max-w-4xl">

                <div className="overflow-hidden absolute bg-pink-300 rounded-full left-24 top-8 opacity-20 blur-3xl w-64 h-64"></div>

                <div className="pt-6 my-auto text-center space-y-4">
                    <div>
                        <p className="mb-3 text-xl font-semibold tracking-wide text-gray-200 md:text-3xl">
                            Greetings, fellow tech explorer!<br/>
Step into my realm, where the worlds of coding and Linux converge in captivating harmony.</p>
                        <p className="py-3 italic font-medium tracking-wide text-white text-md md:text-lg opacity-90">
                            I&apos;m a software developer fueled by a love for coding and Linux. 
                            <br/>Every now and then I <del className="px-1 text-white line-through bg-red-600"> break</del> <ins className="px-1 text-white bg-blue-600 bg-blue-800"> tinker</ins> my linux machine. <br/> Sharing experiences and insights through writing.
                        </p>
                    </div>
                    <figcaption className="font-medium">
                        <div className="text-purple-400">
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
