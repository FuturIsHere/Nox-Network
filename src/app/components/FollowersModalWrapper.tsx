import prisma from '@/lib/client'
import { notFound } from 'next/navigation'
import FollowersModal from './FollowersModal'
import { auth } from '@clerk/nextjs/server'

type Props = {
  username: string
}

export default async function FollowersModalWrapper({ username }: Props) {
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
          followings: true,
        },
      },
    },
  })

  if (!user) return notFound()

  // Ceux qui suivent l'utilisateur
  const followers = await prisma.follower.findMany({
    where: { followingId: user.id }, // L'utilisateur est suivi par ces personnes
    include: {
      follower: { // Récupérer l'information des followers
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
  const followersList = followers.map(f => f.follower)
  
  // Vérifier si l'utilisateur connecté est le propriétaire du profil
  const isOwnProfile = currentUserId === user.id
  
  return (
    <div>
      <div className="flex flex-col items-center">
        <span>
        <FollowersModal 
          followerCount={user._count.followings || 0} 
          username={user.username} 
          followers={followersList}
          currentUserId={isOwnProfile ? currentUserId : undefined}
        />
        </span>
      </div>
    </div>
  )
}