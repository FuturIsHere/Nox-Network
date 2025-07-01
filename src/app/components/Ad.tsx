import Image from "next/image"


const Ad = ({ size }: { size: "sm" | "md" | "lg" }) => {
    return (
        <div className='p-4 bg-white rounded-[30px] shadow-md'>
            <div className="flex items-center justify-between text-gray-400">
                <span>Sponsored Ads</span>
            </div>
            <div className={`flex flex-col mt-4 ${size === "sm" ? "gap-4" : "gap-5"}`}>
                <div className={`relative w-full ${size === "sm" ? "h-36" : size === "md" ? "h-36" : "h-48"}`}>
                    <Image src="/GeaforeLogo.png" alt="" fill className="rounded-xl object-cover" />
                </div>
                <div className="flex items-center gap-3">
                    <Image src="/GeaforeLogo2.png" alt="" width={24} height={24} className="rounded-full w-8 h-8 object-cover" />
                    <span className="text-blue-500 text-[14px] font-medium">Geafore</span>
                </div>
                <p className={size === "sm" ? "text-xs" : "text-sm"}>
                    {size === "sm" ? "Let's code the future, develop without limits." : size === "md" ? "We craft custom, sleek, and powerful web experiences to help your brand shine online. Tell us what you want, we’ll make it happen." : "sdjlfjs zksdfsdkmfksd"}
                </p>
                <div className="flex justify-center items-center">
                    <button className="bg-black text-white px-4 py-2 text-[14px] rounded-[30px]">Learn More</button>
                </div>

            </div>
        </div>
    )
}

export default Ad