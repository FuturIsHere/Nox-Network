import Link from "next/link"
import ProfileCard from "./ProfileCard"
import Image from "next/image"
import Ad from "@/app/components/Ad"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/client"
import UpdateUserLeftMenu from "./UpdateUserLeftMenu"
import { MessageIconWithBadge } from "./MessageIconWithBadge"

const LefttMenu = async ({ type }: { type: "home" | "profile" }) => {
  // Récupérer l'utilisateur actuel pour le modal UpdateUser
  const { userId } = await auth()
  let currentUser = null

  if (userId) {
    currentUser = await prisma.user.findUnique({
      where: {
        id: userId
      }
    })
  }

  return (
    <div className='flex flex-col gap-6'>
      {type === "home" && <ProfileCard />}
      <div className='p-4 bg-white rounded-[30px] shadow-md'>
        <div className='grid grid-cols-3 gap-6 place-items-center  pb-5'>
          <Link href="/" className="flex flex-col items-center gap-2 p-3 group h-20">
            <div className="transition-transform duration-200 group-hover:scale-110 w-12 h-12">
              <Image src="/posts.png" alt="" width={120} height={120} className="w-full h-full object-contain" />
            </div>
            <span className="text-xs text-center mt-auto">Feeds</span>
          </Link>

          {/* Remplacer le Link par le composant MessageIconWithBadge */}
          <MessageIconWithBadge />
          
          <Link href="/notifications" className="flex flex-col items-center gap-2 p-3 group h-20">
            <div className="transition-transform duration-200 group-hover:scale-110 w-12 h-12">
              <Image src="/activity.png" alt="" width={120} height={120} className="w-full h-full object-contain" />
            </div>
            <span className="text-xs text-center mt-auto">Notifications</span>
          </Link>
          
          <Link href={currentUser ? `/profile/${currentUser.username}/media?tab=images` : ""} className="flex flex-col items-center gap-2 p-3 group h-20">
            <div className="transition-transform duration-200 group-hover:scale-110 w-12 h-12">
              <Image src="/albums.png" alt="" width={120} height={120} className="w-full h-full object-contain" />
            </div>
            <span className="text-xs text-center mt-auto">Albums</span>
          </Link>
          
          <Link href={currentUser ? `/profile/${currentUser.username}/media?tab=videos` : ""} className="flex flex-col items-center gap-2 p-3 group h-20">
            <div className="transition-transform duration-200 group-hover:scale-110 w-12 h-12">
              <Image src="/videos.png" alt="" width={120} height={120} className="w-full h-full object-contain" />
            </div>
            <span className="text-xs text-center mt-auto">Videos</span>
          </Link>
          
          <Link href={currentUser ? `/profile/${currentUser.username}/followers` : "/"} className="flex flex-col items-center gap-2 p-3 group h-20">
            <div className="transition-transform duration-200 group-hover:scale-110 w-12 h-12">
              <Image src="/lists.png" alt="" width={120} height={120} className="w-full h-full object-contain" />
            </div>
            <span className="text-xs text-center mt-auto">Friends</span>
          </Link>
          
          {/* Remplacer le Link par le composant UpdateUserLeftMenu si l'utilisateur est connecté */}
          {currentUser ? (
            <div className="flex flex-col items-center gap-2 p-3 group h-20">
              <div className="w-12 h-12">
                <UpdateUserLeftMenu user={currentUser} />
              </div>
              <span className="text-xs text-center mt-auto">Update profile</span>
            </div>
          ) : (
            <Link href="/" className="flex flex-col items-center gap-2 p-3 group h-20">
              <div className="transition-transform duration-200 group-hover:scale-110 w-12 h-12">
                <Image src="/settings.png" alt="" width={120} height={120} className="w-full h-full object-contain" />
              </div>
              <span className="text-xs text-center mt-auto">Update profile</span>
            </Link>
          )}
        </div>
      </div>
      <Ad size="sm" />
    </div>
  )
}

export default LefttMenu