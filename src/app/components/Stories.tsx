import prisma from "@/lib/client"
import { auth } from "@clerk/nextjs/server"
import StoryList from "./StoryList"

const Stories = async () => {
    const { userId: currentUserId } = await auth()

    if (!currentUserId) return null;

    // Récupérer les stories des utilisateurs suivis et de l'utilisateur actuel
    // qui n'ont pas expiré (moins de 24h)
    const stories = await prisma.story.findMany({
        where: {
            expiresAt: {
                gt: new Date(), // Stories non expirées
            },
            OR: [
                {
                    // Stories des utilisateurs que l'utilisateur actuel suit
                    userId: {
                        in: [
                            currentUserId,
                            ...(await prisma.follower.findMany({
                                where: { followerId: currentUserId },
                                select: { followingId: true },
                            })).map(follow => follow.followingId)
                        ]
                    }
                }
            ]
        },
        include: {
            user: true,
        },
        orderBy: {
            createdAt: 'desc' // Afficher les stories les plus récentes en premier
        }
    })

    return (
        <div className="p-4 bg-transparent rounded-[30px] overflow-scroll text-xs scrollbar-hide">
            <div className="flex gap-8 w-max">
                <StoryList stories={stories} userId={currentUserId}/>
            </div>
        </div>
    )
}

export default Stories