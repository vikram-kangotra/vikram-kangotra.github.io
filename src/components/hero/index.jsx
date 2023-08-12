'use client'

import { Syne } from "next/font/google"
import HeroImage from "./hero-image"
import { hero_image_1, hero_image_2, hero_image_3, hero_image_4, hero_image_5, hero_image_6} from "../../assets"
import HeroButton from "./heroButton"

const syne = Syne({ subsets: ['latin'], weights: ['400', '700'] })

export default function Hero() {

  return (
      <header className='flex flex-col items-center content-center justify-start py-10 overflow-hidden md:py-20 gap-16 md:gap-28'>
        <div className="z-10 flex items-center justify-center">
            <span className="text-2xl font-medium lg:text-4xl">Vikram Kangotra</span>
        </div>

        <div className="flex flex-col items-center justify-center px-5">
          <h1 className={`z-10 text-4xl font-bold text-center md:text-6xl text-tertiary leading-12 ${syne.className}`}>Code. Passion. Linux.</h1>
          <p className="max-w-xl my-5 text-sm text-center opacity-90 md:text-lg text-tertiary leading-7">
Discover the captivating universe of Vikram Kangotra, a passionate programming enthusiast on a continuous learning odyssey. Explore intricate code creations driven by Linux and open-source harmony, unveiling a symphony of unity. Immerse yourself in innovative projects, enlightening insights, and the evolving artistry of software development. Join me on this thrilling tech journey, crafting our digital masterpiece together, keystroke by keystroke.
          </p>
            <div className="flex flex-col justify-center md:flex-row gap-3">
              <HeroButton link="projects" bgColor="slate-800" textColor="tertiary">View Projects</HeroButton>
              <HeroButton link="blogs" bgColor="slate-800" textColor="tertiary">Read Blog</HeroButton>
          </div>
        </div>

        <div className="z-10 flex flex-row content-center justify-center py-10 overflow-hidden flex-nowrap shrink-0 gap-5">
            <HeroImage containerClassName='bg-slate-950' imageClassName='rounded-lg' src={hero_image_1} alt="keyboard" />
            <HeroImage containerClassName='bg-slate-900' imageClassName='rounded-e-full rounded-bl-full' src={hero_image_2} alt="linux" />
            <HeroImage containerClassName='bg-slate-950' imageClassName='rounded-lg' src={hero_image_3} alt="Miosis" />
            <HeroImage containerClassName='bg-slate-900' imageClassName='rounded-ss-[8rem] rounded-ee-[8rem]' src={hero_image_4} alt="artistic globe" />
            <HeroImage containerClassName='bg-slate-950' imageClassName='rounded-lg' src={hero_image_5} alt="Proto Rust" />
            <HeroImage containerClassName='bg-slate-900' imageClassName='rounded-e-3xl rounded-bl-3xl rounded-ss-[5rem]' src={hero_image_6} alt="collaboration" />
        </div>
      </header>
  )
}
