import prisma from '@/lib/client'
import { notFound } from 'next/navigation'
import FollowingsModal from './FollowingsModal'
import { auth } from '@clerk/nextjs/server'

type Props = {
  username: string
}

export default async function FollowingsModalWrapper({ username }: Props) {
  const { userId: currentUserId } = auth()
  
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      surname: true,
      _count: {
        select: {
          followers: true,
        },
      },
    },
  })

  if (!user) return notFound()

  // Ceux que l'utilisateur suit
  const followings = await prisma.follower.findMany({
    where: { followerId: user.id }, // L'utilisateur suit ces personnes
    include: {
      following: { // Récupérer l'information des personnes suivies
        select: {
          id: true,
          username: true,
          avatar: true,
          name: true,
          surname: true,
        },
      },
    },
  })

  // Transmettre les bonnes données au composant
  const followingsList = followings.map(f => f.following)
  
  // Vérifier si l'utilisateur connecté est le propriétaire du profil
  const isOwnProfile = currentUserId === user.id
  
  return (
    <div>
      <span className="flex flex-col items-center">
        <FollowingsModal 
          followingCount={user._count.followers || 0} 
          username={user.username} 
          followings={followingsList}
          currentUserId={isOwnProfile ? currentUserId : undefined}
        />
      </span>
    </div>
  )
}