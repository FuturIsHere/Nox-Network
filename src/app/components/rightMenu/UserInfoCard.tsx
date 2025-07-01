import Link from "next/link"
import Image from "next/image"
import { User } from "@/generated/prisma"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/client"
import UserInfoCardInteraction from "./UserInfoCardInteraction"
import UpdateUser from "./updateUser"


const UserInfoCard = async ({ user }: { user: User }) => {

    const createdAtDate = new Date(user.createdAt)
    const formattedDate = createdAtDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })

    let isUserBlocked = false
    let isFollowing = false
    let isFollowingSent = false

    // Await auth() - fix for Next.js 15
    const { userId: currentUserId } = await auth()
    if (currentUserId) {
        const blockRes = await prisma.block.findFirst({
            where: {
                blockerId: currentUserId,
                blockedId: user.id
            }
        })
        blockRes ? (isUserBlocked = true) : (isUserBlocked = false);
        const followRes = await prisma.follower.findFirst({
            where: {
                followerId: currentUserId,
                followingId: user.id
            }
        })
        followRes ? (isFollowing = true) : (isUserBlocked = false);
        const followReqRes = await prisma.followRequest.findFirst({
            where: {
                senderId: currentUserId,
                receiverId: user.id
            }
        })
        followReqRes ? (isFollowingSent = true) : (isUserBlocked = false);
    }
    return (
        <div className='p-4 bg-white rounded-[30px] shadow-md flex flex-col gap-4 min-h-[120px]'>

            {/*BOTTOM */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center font-medium">
                        <span className="text-[17px] font-[600]"></span>
                        {currentUserId === user.id ? (<UpdateUser user={user} />) : (<Link href="/" className="text-blue-500 text-xs">See all</Link>)}
                    </div>
                    <span className="text-black font-[700] text-[25px]">{(user.name && user.surname) ? user.name + " " + user.surname : user.username}</span>
                    <span className="text-sm">@{user.username}</span>
                </div>
                {user.description && <p className="text-[#86868b] text-[15px]">
                    {user.description}
                </p>}
                {user.city && <div className="flex items-center gap-2 text-[15px]">
                    <Image src="/map.png" alt="" width={16} height={16} />
                    <span>Linving in <b>{user.city}</b></span>
                </div>}
                {user.school && <div className="flex items-center gap-2 text-[15px]">
                    <Image src="/school.png" alt="" width={16} height={16} />
                    <span>Went to <b>{user.school}</b></span>
                </div>}
                {user.work && <div className="flex items-center gap-2 text-[15px]">
                    <Image src="/work.png" alt="" width={16} height={16} />
                    <span>Works at <b>{user.work}</b></span>
                </div>}
                <div className="flex items-center justify-between text-[15px]">
                    {user.website && <div className="flex gap-1 items-center ">
                        <Image src="/link.png" alt="" width={16} height={16} />
                        <Link href={user.website} className="text-blue-500 font-medium">{user.website}</Link>
                    </div>}
                    <div className="flex gap-1 items-center">
                        <Image src="/date.png" alt="" width={16} height={16} />
                        <span className="text-gray-400">Joined {formattedDate}</span>
                    </div>
                </div>

                {currentUserId && currentUserId !== user.id && (<UserInfoCardInteraction userId={user.id} isUserBlocked={isUserBlocked} isFollwing={isFollowing} isFollwingSent={isFollowingSent} />)}
            </div>
        </div>
    )

}

export default UserInfoCard