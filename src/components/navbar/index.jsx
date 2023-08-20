import Link from "next/link";
import {useRouter} from "next/router";

export default function Navbar() {
    const router = useRouter();

    return ( 
        <nav className="bg-[#000011] sticky top-0">
          <div className="flex flex-wrap items-center justify-between p-4 mx-auto max-w-screen-xl">
            <Link href="/" className="flex items-center">
                <span className="self-center text-4xl font-semibold text-transparent whitespace-nowrap bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Vikram Kang
                <svg className="inline w-6 fill-pink-400"
                    viewBox="0 0 192.000000 192.000000"
                    preserveAspectRatio="xMidYMid meet"> 
                    <g transform="translate(0.000000,192.000000) scale(0.100000,-0.100000)" stroke="none">
                    <path d="M850 1868 c-347 -34 -658 -263 -785 -577 -50 -123 -68 -224 -62 -356
                    13 -295 150 -557 366 -699 97 -64 188 -112 197 -104 8 9 -30 73 -168 281 -165
                    250 -212 369 -212 542 -1 116 13 181 61 285 70 154 214 302 366 374 115 55
                    211 76 352 76 151 0 243 -21 375 -87 79 -39 110 -63 186 -138 78 -77 98 -104
                    137 -185 59 -122 82 -231 74 -355 -13 -219 -133 -428 -315 -548 -86 -57 -106
                    -80 -106 -122 0 -81 89 -112 169 -58 237 159 363 339 416 595 61 299 -28 589
                    -247 799 -92 88 -139 121 -251 178 -169 84 -359 119 -553 99z"/>
                    <path d="M841 1609 c-150 -26 -272 -90 -381 -199 -136 -136 -197 -298 -187
                    -494 8 -166 17 -184 307 -639 69 -108 131 -199 139 -202 25 -10 200 -29 207
                    -23 7 8 -81 158 -281 479 -171 275 -190 321 -183 457 5 114 42 197 128 286
                    102 107 228 160 375 160 197 0 377 -110 458 -281 27 -58 32 -81 35 -161 7
                    -173 -61 -316 -193 -403 -77 -51 -98 -84 -84 -133 18 -63 76 -82 147 -49 51
                    24 200 176 240 244 87 149 110 317 65 479 -44 162 -188 332 -344 409 -46 22
                    -111 48 -144 57 -74 19 -232 26 -304 13z"/>
                    <path d="M890 1350 c-144 -26 -250 -105 -310 -232 -64 -136 -47 -260 60 -418
                    20 -30 90 -143 155 -250 65 -107 149 -241 186 -297 l68 -101 43 6 c64 8 139
                    26 141 33 2 8 -207 351 -346 569 -121 188 -147 241 -147 301 0 63 40 139 92
                    175 35 25 53 30 117 32 65 3 83 0 121 -20 64 -35 110 -112 110 -188 0 -69 -17
                    -102 -86 -163 -62 -55 -72 -82 -50 -126 56 -108 204 -43 294 131 24 47 27 63
                    27 158 0 93 -3 111 -27 163 -80 169 -259 260 -448 227z"/>
                    </g>
                </svg>tra</span>
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
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
