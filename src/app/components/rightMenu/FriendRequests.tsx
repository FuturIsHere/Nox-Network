import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/client"
import FriendRequestsList from "./FriendRequestList"

const FriendRequests = async () => {

  // Await auth() - fix for Next.js 15
  const { userId } = await auth()

  if (!userId) return null;

  // Récupérer les informations de l'utilisateur connecté pour obtenir son username
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true }
  })

  if (!currentUser) return null;

  const requests = await prisma.followRequest.findMany({
    where: {
      receiverId: userId
    },
    include: {
      sender: true,
    }
  })

  if (requests.length === 0) return null;

  return (
    <div className='p-4 bg-white rounded-[30px] shadow-md flex flex-col gap-4 min-h-[120px]' data-friend-requests-container>
      <div className="flex justify-between items-center">
        <span className="text-[17px] font-[600]">Friends Requests</span>
        <Link href={`/profile/${currentUser.username}/requests`} className="text-blue-500 text-xs hover:underline">
          See all
        </Link>
      </div>
      <FriendRequestsList requests={requests} />
    </div>
  )
}

export default FriendRequests