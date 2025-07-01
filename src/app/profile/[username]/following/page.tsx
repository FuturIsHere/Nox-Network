// src/app/profile/[username]/following/page.tsx
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

export default async function FollowingPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: { id: true, username: true, avatar: true },
  })

  if (!user) return notFound()

  // Récupère les personnes que cet utilisateur suit
  const followings = await prisma.follower.findMany({
    where: {
      followerId: user.id,
    },
    include: {
      following: true,
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
      <h1 className="text-xl font-bold text-center mb-10">Followings of @{user.username}</h1>

      <ProfileTabBar username={user.username} />
      <div className="grid grid-cols-2 gap-4 justify-items-center mt-6">
        {followings.map(({ following }) => (
          <div key={following.id}>
            <div className="p-4 bg-white rounded-[30px] shadow-md text-sm flex flex-col gap-6 h-[220px] w-[245px]">
              <div className="h-20 relative">
                <img
                  src={following.cover || '/default-avatar.png'}
                  alt={following.username}
                  className="rounded-xl object-cover h-[80px] w-[100%]"
                />
                <Link href={`/profile/${following.username}`} className="font-medium">
                  <img
                    src={following.avatar || '/default-avatar.png'}
                    alt={following.username}
                    width={48}
                    height={48}
                    className="rounded-full object-cover w-12 h-12 absolute left-0 right-0 m-auto -bottom-6 ring-2 ring-white z-10"
                  />
                </Link>
                <div className="mt-[30px] flex flex-col gap-2 items-center relative">
                  <Link href={`/profile/${following.username}`} className="font-medium">
                    <span> {(following.name && following.surname) ? following.name + " " + following.surname : following.username}</span>
                  </Link>
                </div>
                <div className="flex justify-around items-center mt-[20px]">
                  <FollowersModalWrapper username={following.username} />
                  <FollowingsModalWrapper username={following.username} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {followings.length === 0 && (
        <div className="text-center text-[50px] font-[700] text-[#d0d0d0]">Not following anyone yet</div>
      )}
      </div>
       <div className="hidden lg:block w-[30%]">
        <RightMenu />
      </div>
    </div>
  )
}
