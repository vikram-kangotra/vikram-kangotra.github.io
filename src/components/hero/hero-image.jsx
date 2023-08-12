import Image from "next/image"

export default function HeroImage({src, alt, containerClassName, imageClassName}) {
    return (
        <div className={`aspect-square flex-wrap flex justify-center items-center p-3 box-sizing w-60 h-60 rounded-xl overflow-hidden flex-shrink-0 border border-quaternary ${containerClassName}`}>
            <Image className={`${imageClassName}`} src={src} alt={alt} priority={true} />
        </div>
    )
}
