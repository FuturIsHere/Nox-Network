import Feed from "@/app/components/feed/Feed"
import LeftMenu from "@/app/components/leftMenu/LeftMenu"
import RightMenu from "@/app/components/rightMenu/RightMenu"
import FollowersModalWrapper from '@/app/components/FollowersModalWrapper'
import FollowingsModalWrapper from '@/app/components/FollowingsModalWrapper'
import prisma from "@/lib/client"
import { auth } from "@clerk/nextjs/server"
import Image from "next/image"
import { notFound } from "next/navigation"
import ProfileStoryAvatar from "@/app/components/ProfileStoryAvatar"

const ProfilePage = async ({ params }: { params: Promise<{ username: string }> }) => {
  // Await params - fix for Next.js 15
  const { username } = await params;

  const user = await prisma.user.findFirst({
    where: {
      username,
    },
    include: {
      _count: {
        select: {
          followers: true,
          followings: true,
          posts: true,
        },
      },
    },
  });
  
  if (!user) return notFound()

  // Await auth() - fix for Next.js 15
  const { userId: currentUserId } = await auth();

  let isBlocked;

  if (currentUserId) {
    const res = await prisma.block.findFirst({
      where: {
        blockerId: user.id,
        blockedId: currentUserId,
      },
    });
    if (res) isBlocked = true
  }
  else {
    isBlocked = false;
  }
  if (isBlocked) return notFound();

  // Déterminer si c'est le profil de l'utilisateur connecté
  const isOwnProfile = currentUserId === user.id;

  // Récupérer les stories de cet utilisateur
  const userStories = await prisma.story.findMany({
    where: {
      userId: user.id,
      expiresAt: {
        gt: new Date(), // Stories non expirées
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return (
    <div className='flex gap-6'>
      <div className="hidden xl:block w-[20%]">
        <LeftMenu type={isOwnProfile ? "profile" : "home"} />
      </div>
      <div className="w-full lg:w-[70%] xl:w-[50%]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center">
            <div className="w-full h-64 relative">
              <Image src={user.cover || "/noCover.png"} alt="" fill className="object-cover rounded-[30px]" />
              
              {/* Avatar avec intégration des stories */}
              <ProfileStoryAvatar 
                user={user}
                stories={userStories}
                currentUserId={currentUserId}
              />
            </div>
            <h1 className="mt-20 mb-4 text-black font-[700] text-[25px]">{(user.name && user.surname) ? user.name + " " + user.surname : user.username}</h1>
            <div className="flex items-center justify-center gap-12 mb-4">
              <div className="flex flex-col items-center">
                <span className="font-[600]">{user._count.posts}</span>
                <span className="text-sm">Posts</span>
              </div>
              <FollowersModalWrapper username={user.username} />
              <FollowingsModalWrapper username={user.username} />
            </div>
          </div>
          <Feed username={username} />
        </div>
      </div>
      <div className="hidden lg:block w-[30%]">
        <RightMenu user={user} />
      </div>
    </div>
  )
}

export default ProfilePage