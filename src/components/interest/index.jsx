import {interest_image_1, interest_image_2, interest_image_3, interest_image_4} from "@/assets";
import InterestCard from "./interest-card";

export default function Interest() {
    return (
        <div className="flex flex-col items-center content-center p-10 overflow-hidden flex-nowrap">
            <div className="flex flex-col max-w-4xl z-1 md:grid grid-cols-3 grid-rows-2 gap-55">
                <InterestCard className="col-span-2" heading="Passion" subheading="Sleepless nights of coding" imageSrc={interest_image_1}/>
                <InterestCard heading="Linux" subheading="Open-source love affair" imageSrc={interest_image_2}/>
                <InterestCard heading="Innovation" subheading="Re-Imagining software solutions" imageSrc={interest_image_3}/>
                <InterestCard className="col-span-2" heading="Collaboration" subheading="Working together for Impact" imageSrc={interest_image_4}/>
            </div> 
        </div>
    )
}
