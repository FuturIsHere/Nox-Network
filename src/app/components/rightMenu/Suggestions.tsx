import Link from "next/link"
import Image from "next/image"
import prisma from "@/lib/client"
import { auth } from "@clerk/nextjs/server"
import SuggestionFollowButton from "./SuggestionFollowButton"

const Suggestions = async () => {
  // Await auth() - fix for Next.js 15
  const { userId: currentUserId } = await auth()
  
  if (!currentUserId) {
    return null // Ne pas afficher les suggestions si l'utilisateur n'est pas connecté
  }

  // Récupérer les utilisateurs que l'utilisateur actuel suit déjà
  const existingFollows = await prisma.follower.findMany({
    where: {
      followerId: currentUserId
    },
    select: {
      followingId: true
    }
  })

  // Récupérer les demandes d'amitié en cours
  const pendingRequests = await prisma.followRequest.findMany({
    where: {
      senderId: currentUserId
    },
    select: {
      receiverId: true
    }
  })

  // Récupérer les utilisateurs bloqués
  const blockedUsers = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: currentUserId },
        { blockedId: currentUserId }
      ]
    },
    select: {
      blockedId: true,
      blockerId: true
    }
  })

  // Créer une liste d'IDs à exclure
  const excludedIds = [
    currentUserId,
    ...existingFollows.map(f => f.followingId),
    ...pendingRequests.map(r => r.receiverId),
    ...blockedUsers.flatMap(b => [b.blockedId, b.blockerId])
  ]

  // Récupérer des utilisateurs aléatoires (max 5)
  const suggestions = await prisma.user.findMany({
    where: {
      id: {
        notIn: excludedIds
      }
    },
    select: {
      id: true,
      username: true,
      avatar: true,
      name: true,
      surname: true,
    },
    take: 10, // Prendre plus pour avoir de la variété
    orderBy: {
      createdAt: 'desc' // Vous pouvez changer cela pour un ordre aléatoire
    }
  })

  // Mélanger les résultats et prendre seulement 5
  const shuffledSuggestions = suggestions
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)

  if (shuffledSuggestions.length === 0) {
    return null // Ne pas afficher le composant s'il n'y a pas de suggestions
  }

  return (
    <div className='p-4 bg-white rounded-[30px] shadow-md flex flex-col gap-4 min-h-[200px]'>
      <div className="flex justify-between items-center">
        <span className="text-[17px] font-[600]">Suggestions for you</span>
        <Link href="/suggestions" className="text-blue-500 text-xs">See all</Link>
      </div>
      
      <div className="flex flex-col gap-3">
        {shuffledSuggestions.map((user) => (
          <div key={user.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${user.username}`}>
                <Image 
                  src={user.avatar || "/noAvatar.png"} 
                  alt={user.username} 
                  className="w-10 h-10 rounded-full object-cover cursor-pointer" 
                  width={40} 
                  height={40} 
                />
              </Link>
              <Link href={`/profile/${user.username}`}>
              <div className="flex flex-col">
                <span className="text-[15px] text-black font-[600]">@{user.username}</span>
                <div 
                  
                  className="text-[15px] text-gray-400 font-[500]"
                >
                  {(user.name && user.surname) 
                    ? `${user.name} ${user.surname}` 
                    : user.username
                  }
                </div>
                
              </div>
              </Link>
            </div>
            
            <SuggestionFollowButton userId={user.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Suggestions