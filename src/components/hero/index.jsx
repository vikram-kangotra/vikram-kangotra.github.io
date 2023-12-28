import HeroButton from "./heroButton"
import Typewriter from "./typeWriters"

import Logo from "../logo"

export default function Hero() {

  return (
      <header className='flex flex-col items-center content-center justify-start py-10 overflow-hidden md:py-20 gap-16 md:gap-28'>
        
        <Logo />

        <div className="relative">

          <div className="overflow-hidden absolute bg-yellow-300 rounded-full right-0 top-10 blur-3xl w-72 h-72 opacity-20"></div>

          <div className="flex flex-col items-center justify-center px-5">

            <h1 className={`text-4xl font-bold text-center md:text-7xl`}><Typewriter text="Code. Passion. Linux. " delay={100}></Typewriter></h1>
            <p className="relative max-w-3xl my-5 text-sm text-center opacity-90 md:text-lg text-tertiary leading-7">
Discover the captivating universe of Vikram Kangotra, a passionate programming enthusiast on a continuous learning odyssey. Explore intricate code creations driven by Linux and open-source harmony, unveiling a symphony of unity. Immerse yourself in innovative projects, enlightening insights, and the evolving artistry of software development. Join me on this thrilling tech journey, crafting our digital masterpiece together, keystroke by keystroke.
            </p>
            <div className="flex flex-col justify-center md:flex-row gap-3">
              <HeroButton link="projects" bgColor="slate-800" textColor="tertiary">View Projects</HeroButton>
              <HeroButton link="blogs" bgColor="slate-800" textColor="tertiary">Read Blog</HeroButton>
          </div>
        </div>
      </div>

      </header>
  )
}
