import Link from "next/link";
import {useRouter} from "next/router";
import Logo from "../logo";

export default function Navbar() {
    const router = useRouter();

    return ( 
        <nav className="bg-[#000] sticky top-0">
          <div className="flex flex-wrap items-center justify-between p-4 mx-auto max-w-screen-xl">
            <Link href="/" className="flex items-center">
                <Logo />
            </Link>
            <button data-collapse-toggle="navbar-default" type="button" className="inline-flex items-center justify-center w-10 h-10 p-2 text-sm text-gray-400 text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 hover:bg-gray-700 focus:ring-gray-600" aria-controls="navbar-default" aria-expanded="false">
                <span className="sr-only">Open main menu</span>
                <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 1h15M1 7h15M1 13h15"/>
                </svg>
            </button>
            <div className="hidden w-full md:block md:w-auto" id="navbar-default">
              <ul className="flex flex-col p-4 mt-4 font-medium border border-gray-100 border-gray-700 rounded-lg md:p-0 md:flex-row md:space-x-8 md:mt-0 md:border-0">
                <li>
                    <button className="px-5 border border-2 rounded-full rouneded border-slate-400 hover:bg-purple-500" onClick={() => router.back() }> 
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="white" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062A1.125 1.125 0 0121 8.688v8.123zM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953L9.567 7.71a1.125 1.125 0 011.683.977v8.123z" />
                        </svg>
                    </button>
                </li>
                <li>
                  <Link href="/" className="block py-2 pl-3 pr-4 text-white text-gray-900 rounded md:border-0 md:hover:text-purple-700 md:p-0 md:hover:text-purple-500 hover:text-white">Home</Link>
                </li>
                <li>
                  <Link href="/blogs" className="block py-2 pl-3 pr-4 text-white text-gray-900 rounded md:border-0 md:hover:text-purple-700 md:p-0 md:hover:text-purple-500 hover:text-white">Blogs</Link>
                </li>
                <li>
                  <Link href="/projects" className="block py-2 pl-3 pr-4 text-white text-gray-900 rounded hover:bg-gray-100 md:hover:bg-transparent md:border-0 md:hover:text-purple-700 md:p-0 md:hover:text-purple-500 hover:bg-gray-700 hover:text-white">Projects</Link>
                </li>
              </ul>
            </div>
          </div>
        </nav>

    )
}
