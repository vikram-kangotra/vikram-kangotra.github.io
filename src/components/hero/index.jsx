import HeroButton from "./heroButton"
import Typewriter from "./typeWriters"

import Logo from "../logo"

export default function Hero() {

  return (
      <header className='flex flex-col items-center content-center justify-start py-10 md:py-20 gap-16 md:gap-28'>
        
        <Logo />

        <div className="relative">

          <div className="absolute right-0 bg-yellow-300 rounded-full blur-3xl w-72 h-72 opacity-20"></div>

          <div className="flex flex-col items-center justify-center px-5">

            <h1 className={`text-4xl font-bold text-center md:text-7xl`}><Typewriter text="Code. Passion. Linux. " delay={100}></Typewriter></h1>
            <p className="relative max-w-3xl my-5 text-base text-center opacity-90 md:text-lg text-tertiary leading-5 md:leading-7">
                Explore my world as a passionate programmer always eager to learn and code. I’m diving into various projects and sharing my journey through software development and innovation. Follow along as I build and create, one keystroke at a time!
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
