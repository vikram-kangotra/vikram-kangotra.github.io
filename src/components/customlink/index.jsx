import Link from "next/link";

const CustomLink = ({href, children}) => {
    return (
        <Link href={href} className="text-blue-500 md:no-underline hover:text-white transition-colors duration-300 hover:underline">
            {children}
        </Link>
    )
}

export default CustomLink;
