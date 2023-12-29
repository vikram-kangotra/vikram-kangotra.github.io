import {socialMedia} from "@/constants";
import Link from "next/link";
import {useEffect, useState} from "react";

export default function Footer() {

    const [date, setDate] = useState(null);

    useEffect(() => {
        setDate(new Date().getFullYear())
    }, [])

    return (
        <footer className="relative flex flex-col items-center content-center justify-center p-10 gap-5">
            <div className="flex flex-col items-center content-center max-w-4xl gap-10">
                <div className="flex items-center justify-center">
                    <ul className="flex flex-wrap items-center text-sm text-gray-500 sm:mb-0">
                    {socialMedia?.map((media, index) => (
                        <li key={index} className="mr-4 md:mr-6">
                        <Link href={media.link} aria-label={media.name}>
                        <media.icon size={24}/>
                        </Link>
                        </li>
                    ))}
                    </ul>
                </div>
                <div className="overflow-hidden text-sm font-medium text-center opacity-50 md:text-base">
                    &copy; {date} Site by Vikram Kangotra. All rights reserved.
                </div>
            </div>
        </footer>
    )
}
