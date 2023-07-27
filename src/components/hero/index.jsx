'use client'

import { Syne } from "next/font/google"
import HeroImage from "./hero-image"
import { hero_image_1, hero_image_2, hero_image_3, hero_image_4, hero_image_5, hero_image_6} from "../../assets"
import HeroButton from "./heroButton"

const syne = Syne({ subsets: ['latin'], weights: ['400', '700'] })

export default function Hero() {

  return (
      <header className='flex flex-col items-center content-center justify-start py-10 overflow-hidden md:py-20 gap-28'>
        <div className="flex items-center justify-center">
            <span className="text-sm font-medium lg:text-3xl md:text-xl">Vikram Kangotra</span>
        </div>

        <div className="flex flex-col items-center justify-center px-5">
          <h1 className={`text-4xl font-bold text-center md:text-6xl text-tertiary leading-12 ${syne.className}`}>Code. Passion. Linux.</h1>
          <p className="max-w-xl my-5 text-sm text-center opacity-90 md:text-lg text-tertiary leading-7">
            Welcome to the VICIverse, the virtual hub of Vikram Kangotra – a software developer who codes with passion and adores everything Linux and open-source. Prepare to be amazed by a fantastic blend of projects, blogs, and insights into the thrilling realm of software development.
          </p>
            <div className="flex flex-col justify-center md:flex-row gap-3">
              <HeroButton link="projects" bgColor="black" textColor="tertiary">View Projects</HeroButton>
              <HeroButton link="blogs" bgColor="primary" textColor="tertiary">Read Blog</HeroButton>
          </div>
        </div>

        <div className="flex flex-row content-center justify-center py-10 overflow-hidden flex-nowrap shrink-0 gap-5">
            <HeroImage containerClassName='bg-black' imageClassName='' src={hero_image_1} alt="keyboard" />
            <HeroImage containerClassName='bg-primary' imageClassName='rounded-e-full rounded-bl-full' src={hero_image_2} alt="linux" />
            <HeroImage containerClassName='bg-black' imageClassName='' src={hero_image_3} alt="Miosis" />
            <HeroImage containerClassName='bg-primary' imageClassName='rounded-ss-[8rem] rounded-ee-[8rem]' src={hero_image_4} alt="artistic globe" />
            <HeroImage containerClassName='bg-black' imageClassName='' src={hero_image_5} alt="Proto Rust" />
            <HeroImage containerClassName='bg-primary' imageClassName='rounded-e-3xl rounded-bl-3xl rounded-ss-[5rem]' src={hero_image_6} alt="collaboration" />
        </div>
      </header>
  )
}
