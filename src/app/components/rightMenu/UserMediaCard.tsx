import Link from "next/link"
import { User } from "@/generated/prisma"
import prisma from "@/lib/client"
import MediaItem from "./MediaItem"

const UserMediaCard = async ({ user }: { user: User }) => {
  const postsWithMedia = await prisma.post.findMany({
    where: {
      userId: user.id,
      AND: [
        { img: { not: null } },
        { img: { not: "" } },
      ],
    },
    take: 8,
    orderBy: {
      createdAt: "desc",
    },
  })

  // Ne rien afficher si aucun post avec image valide
  if (!postsWithMedia.length) return null

  // Fonction pour vérifier si le média est une vidéo
  const isVideo = (url: string) => {
    if (!url) return false;
    
    // Vérifications pour les extensions de fichiers vidéo
    const videoExtensions = /\.(mp4|webm|ogg|mov|avi|wmv|flv|m4v|3gp|mkv)(\?.*)?$/i;
    if (videoExtensions.test(url)) {
      return true;
    }
    
    // Vérifications pour les chemins contenant 'videos'
    if (url.includes('/videos/')) {
      return true;
    }
    
    return false;
  };

  return (
    <div className="p-4 bg-white rounded-[30px] shadow-md flex flex-col gap-4 min-h-[120px]">
      <div className="flex justify-between items-center">
        <span className="text-[17px] font-[600]">User Media</span>
        <Link href={`/profile/${user.username}/media`} className="text-blue-500 text-xs">See all</Link>
      </div>

      <div className="flex gap-4 justify-between flex-wrap">
        {postsWithMedia.map((post) => (
          <MediaItem
            key={post.id}
            src={post.img!}
            isVideo={isVideo(post.img!)}
            postId={post.id.toString()}
          />
        ))}
      </div>
    </div>
  )
}

export default UserMediaCard