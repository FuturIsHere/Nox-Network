// src/app/profile/[username]/followers/page.tsx
import prisma from '@/lib/client'
import { notFound } from 'next/navigation'
import FollowersModalWrapper from '@/app/components/FollowersModalWrapper'
import FollowingsModalWrapper from '@/app/components/FollowingsModalWrapper'
import Link from "next/link"
import Image from "next/image"
import ProfileTabBar from '@/app/components/ProfileTabBar'
import RightMenu from '@/app/components/rightMenu/RightMenu'
import LeftMenu from '@/app/components/leftMenu/LeftMenu'


type Props = {
  params: { username: string }
}

export default async function FollowersPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: { id: true, username: true, avatar: true },
  })

  if (!user) return notFound()

  // Cherche tous ceux qui suivent cet utilisateur
  const followers = await prisma.follower.findMany({
    where: {
      followingId: user.id,
    },
    include: {
      follower: true, // ceux qui suivent
    },
  })

  return (
    <div className="flex gap-8 pt-6">
      <div className="hidden xl:block w-[20%]">
        <LeftMenu type="home" />
      </div>
      <div className="w-full lg:w-[70%] xl:w-[50%]">
        <div className="flex justify-center">
        <Link href={`/profile/${user.username}`} className="inline-block">
          <Image src={user.avatar || "/noAvatar.png"} alt="" width={70} height={70} className="rounded-full object-cover object-top w-[70px] h-[70px]  left-0 right-0 m-auto -bottom-6 z-10 mb-5" />
        </Link>
        </div>
        <h1 className="text-xl font-bold mb-10 text-center">Followers of @{user.username}</h1>

        <ProfileTabBar username={user.username} />
        <div className="grid grid-cols-2 gap-4 justify-items-center mt-6">
          {followers.map(({ follower }) => (
            <div key={follower.id} className="w-full flex justify-center">
              <div className="p-4 bg-white rounded-[30px] shadow-md text-sm flex flex-col gap-6 h-[220px] w-[245px]">
                <div className="h-20 relative">
                  <img
                    src={follower.cover || '/default-avatar.png'}
                    alt={follower.username}
                    className="rounded-xl object-cover h-[80px] w-[100%]"
                  />
                  <Link href={`/profile/${follower.username}`} className="font-medium">
                    <img
                      src={follower.avatar || '/default-avatar.png'}
                      alt={follower.username}
                      width={48}
                      height={48}
                      className="rounded-full object-cover w-12 h-12 absolute left-0 right-0 m-auto -bottom-6 ring-2 ring-white z-10"
                    />
                  </Link>
                  <div className="mt-[30px] flex flex-col gap-2 items-center relative">
                    <Link href={`/profile/${follower.username}`} className="font-medium">
                      <span> {(follower.name && follower.surname) ? follower.name + " " + follower.surname : follower.username}</span>
                    </Link>
                  </div>
                  <div className="flex justify-around items-center mt-[20px]">
                    <FollowersModalWrapper username={follower.username} />
                    <FollowingsModalWrapper username={follower.username} />
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>
        {followers.length === 0 && (
          <div className="text-center text-[50px] font-[700] text-[#d0d0d0]">No followers yet</div>
        )}
      </div>
      <div className="hidden lg:block w-[30%]">
        <RightMenu />
      </div>
    </div>
  )
}