// src/app/suggestions/page.tsx
import Link from "next/link"
import Image from "next/image"
import prisma from "@/lib/client"
import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"
import SuggestionFollowButton from "@/app/components/rightMenu/SuggestionFollowButton"
import RightMenu from "../components/rightMenu/RightMenu"
import LeftMenu from "../components/leftMenu/LeftMenu"

const SuggestionsPage = async () => {
  const { userId: currentUserId } = auth()
  
  if (!currentUserId) {
    return notFound()
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

  // Récupérer les suggestions avec le nombre de followers
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
      _count: {
        select: {
          followings: true
        }
      }
    },
    take: 50, // Plus de suggestions pour une page complète
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Récupérer quelques followers pour chaque utilisateur suggéré (pour l'affichage "Suivi(e) par...")
  const suggestionsWithMutualFollows = await Promise.all(
    suggestions.map(async (user) => {
      // Trouver les followers communs
      const mutualFollows = await prisma.follower.findMany({
        where: {
          followingId: user.id,
          follower: {
            followers: {
              some: {
                followerId: currentUserId
              }
            }
          }
        },
        include: {
          follower: {
            select: {
              username: true,
              name: true,
              surname: true
            }
          }
        },
        take: 3
      })

      return {
        ...user,
        mutualFollows: mutualFollows.map(f => f.follower)
      }
    })
  )

  // Mélanger les résultats
  const shuffledSuggestions = suggestionsWithMutualFollows
    .sort(() => Math.random() - 0.5)

  return (
    <div className="flex gap-8 pt-6">
               <div className="hidden xl:block w-[20%]"><LeftMenu type="home" /></div>

      <div className="w-full lg:w-[70%] xl:w-[50%]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-black">Suggestions for you</h1>
          </div>
        </div>

        {/* Liste des suggestions */}
        <div className="bg-white rounded-[30px] shadow-md">
          {shuffledSuggestions.map((user, index) => (
            <div 
              key={user.id} 
              className={`flex items-center justify-between p-4 ${
                index !== shuffledSuggestions.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              {/* Partie gauche - Avatar et infos */}
              <div className="flex items-center gap-3">
                <Link href={`/profile/${user.username}`}>
                  <Image 
                    src={user.avatar || "/noAvatar.png"} 
                    alt={user.username} 
                    className="w-11 h-11 rounded-full object-cover cursor-pointer" 
                    width={44} 
                    height={44} 
                  />
                </Link>
                
                <div className="flex flex-col">
                  <Link 
                    href={`/profile/${user.username}`}
                    className="text-[15px] text-black font-[600] hover:opacity-70 transition-opacity"
                  >
                    @{user.username}
                  </Link>
                  
                  <div className="text-[15px] text-gray-500">
                    {(user.name && user.surname) && (
                      <div>{user.name} {user.surname}</div>
                    )}
                    
                    {/* Affichage des followers communs ou nombre de followers */}
                    {user.mutualFollows.length > 0 ? (
                      <div>
                        Suivi(e) par{' '}
                        <span className="font-medium">
                          {user.mutualFollows[0].name && user.mutualFollows[0].surname 
                            ? `${user.mutualFollows[0].name} ${user.mutualFollows[0].surname}`
                            : user.mutualFollows[0].username
                          }
                        </span>
                        {user.mutualFollows.length > 1 && (
                          <span> + {user.mutualFollows.length - 1} autre{user.mutualFollows.length > 2 ? 's' : ''} personne{user.mutualFollows.length > 2 ? 's' : ''}</span>
                        )}
                      </div>
                    ) : (
                      user._count.followings > 0 && (
                        <div>{user._count.followings} follower{user._count.followings > 1 ? 's' : ''}</div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Bouton de suivi */}
              <SuggestionFollowButton userId={user.id} />
            </div>
          ))}
        </div>

        {/* Message si aucune suggestion */}
        {shuffledSuggestions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500 text-lg">Aucune suggestion disponible pour le moment</p>
            <p className="text-gray-400 text-sm mt-2">Revenez plus tard pour découvrir de nouveaux comptes</p>
          </div>
        )}

      </div>
      <div className="hidden lg:block w-[30%]">
        <RightMenu />
      </div>
    </div>
  )
}

export default SuggestionsPage