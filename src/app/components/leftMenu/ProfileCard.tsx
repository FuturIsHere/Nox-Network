import prisma from "@/lib/client"
import { auth } from "@clerk/nextjs/server"
import Image from "next/image"
import Link from "next/link"

const ProfileCard = async () => {

    // Await auth() - fix for Next.js 15
    const { userId } = await auth();

    if (!userId) return null;

    const user = await prisma.user.findFirst({
        where: {
            id: userId,
        },
        include: {
            _count: {
                select: {
                    followings: true,
                },
            },
            followings: {
                take: 3,
                orderBy: {
                    createdAt: "desc"
                },
                include: {
                    follower: true
                }
            }
        }
    });

    console.log(user)

    if (!user) return null
    return (
        <div className='p-4 bg-white rounded-[30px] shadow-md text-sm flex flex-col gap-6'>
            <div className="h-20 relative">
                <Image src={user.cover || "/noCover.png"} alt="" fill className="rounded-xl object-cover" />
                <Link href={`/profile/${user.username}`} className="text-white font-medium">
                    <Image src={user.avatar || "/noAvatar.png"} alt="" width={48} height={48} className="rounded-full object-cover w-12 h-12 absolute left-0 right-0 m-auto -bottom-6 ring-2 ring-white z-10" />
                </Link>
            </div>
            <div className="h-10 flex flex-col gap-2 items-center">
                <span className="">{(user.name && user.surname) ? user.name + " " + user.surname : user.username}</span>
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-1">
                        {user.followings.map((f) => (
                            <Image
                                key={f.follower.id}
                                src={f.follower.avatar || "/noAvatar.png"}
                                alt={f.follower.username}
                                width={15}
                                height={15}
                                className="rounded-full object-cover w-4 h-4 ring-1 ring-white"
                            />
                        ))}
                    </div>
                    {user._count.followings > 0 && (
                    <span className="text-xs text-gray-500">{user._count.followings} Followers</span>
                    )}
                </div>
            </div>
            <Link href={`/profile/${user.username}`} className="text-white font-medium">
                <button className="bg-black p-2 w-full text-white rounded-[99px]">
                    My profile
                </button>
            </Link>
        </div>
    )
}

export default ProfileCard