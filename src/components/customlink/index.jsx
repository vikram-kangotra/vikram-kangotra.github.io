import Link from "next/link";

const CustomLink = ({href, children}) => {
    return (
        <Link 
            href={href} 
            className="text-teal-400 hover:text-teal-300 transition-colors duration-300 hover:underline"
            target="_blank"
        >
            {children}
        </Link>
    );
};

export default CustomLink;
