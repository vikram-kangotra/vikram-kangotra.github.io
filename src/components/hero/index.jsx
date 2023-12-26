import {rays} from "@/assets"
import { Syne } from "next/font/google"
import HeroButton from "./heroButton"
import Typewriter from "./typeWriters"

import Image from "next/image"

const syne = Syne({ subsets: ['latin'], weights: ['400', '700'] })

export default function Hero() {

    /*
     *
     *     <div className="absolute top-0 bg-purple-300 rounded-full blur-3xl -left-4 w-72 h-72 opacity-70 "></div>



    */

  return (
      <header className='flex flex-col items-center content-center justify-start py-10 overflow-hidden md:py-20 gap-16 md:gap-28'>
        <div className="flex items-center justify-center">
            <span className="text-2xl font-medium text-transparent lg:text-4xl bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Vikram Kang
                <svg className="inline w-5 lg:w-6 fill-pink-400"
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
                </svg>
            tra</span>
        </div>

        <div className="relative flex flex-col items-center justify-center px-5">
          <h1 className={`text-4xl font-bold text-center md:text-6xl text-tertiary leading-12 ${syne.className} bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600`}><Typewriter text="Code. Passion. Linux. " delay={100}></Typewriter></h1>
          <p className="relative max-w-xl my-5 text-sm text-center opacity-90 md:text-lg text-tertiary leading-7">
Discover the captivating universe of Vikram Kangotra, a passionate programming enthusiast on a continuous learning odyssey. Explore intricate code creations driven by Linux and open-source harmony, unveiling a symphony of unity. Immerse yourself in innovative projects, enlightening insights, and the evolving artistry of software development. Join me on this thrilling tech journey, crafting our digital masterpiece together, keystroke by keystroke.
          </p>
            <div className="flex flex-col justify-center md:flex-row gap-3">
              <HeroButton link="projects" bgColor="slate-800" textColor="tertiary">View Projects</HeroButton>
              <HeroButton link="blogs" bgColor="slate-800" textColor="tertiary">Read Blog</HeroButton>
          </div>
        </div>

      </header>
  )
}
