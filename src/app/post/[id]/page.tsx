// app/post/[id]/page.tsx
import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/client"
import Post from "@/app/components/feed/Post"
import LeftMenu from "@/app/components/leftMenu/LeftMenu"
import RightMenu from "@/app/components/rightMenu/RightMenu"
import BackButton from "@/app/components/BackButton"
import Link from "next/link"

interface PostPageProps {
  params: {
    id: string
  }
}

const PostPage = async ({ params }: PostPageProps) => {
  const { userId } = await auth()
  
  if (!userId) {
    redirect("/sign-in")
  }

  const postId = parseInt(params.id)
  
  if (isNaN(postId)) {
    notFound()
  }

  // Récupérer le post avec toutes les données nécessaires
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
    include: {
      user: {
        include: {
          _count: {
            select: {
              followers: true,
              followings: true
            }
          }
        }
      },
      likes: {
        select: {
          userId: true
        }
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  })

  if (!post) {
    notFound()
  }

  // Vérifier si l'utilisateur est bloqué ou si le post est privé
  const isBlocked = await prisma.block.findFirst({
    where: {
      OR: [
        {
          blockerId: post.user.id,
          blockedId: userId,
        },
        {
          blockerId: userId,
          blockedId: post.user.id,
        },
      ],
    },
  })

  if (isBlocked) {
    return (
      <div className="flex gap-8 pt-6">
        <div className="hidden xl:block w-[20%]">
          <LeftMenu type="home" />
        </div>
        <div className="w-full lg:w-[70%] xl:w-[50%]">
          <div className="flex flex-col gap-6">
            {/* Bouton retour */}
            <div className="rounded-[30px] p-4">
              <BackButton />
            </div>
            
            <div className="bg-white rounded-[30px] shadow-md p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">🔒</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Content not available
              </h2>
              <p className="text-gray-600">
                This post is not accessible because you are blocked by this user or you have blocked them.
              </p>
            </div>
          </div>
        </div>
        <div className="hidden lg:block w-[30%]">
          <RightMenu />
        </div>
      </div>
    )
  }

  // Transformer les données pour correspondre au type attendu par le composant Post
  const postWithCorrectType = {
    ...post,
    likes: post.likes as [{userId: string}] // Cast vers le type attendu
  }

  return (
    <div className="flex gap-8 pt-6">
      <div className="hidden xl:block w-[20%]">
        <LeftMenu type="home" />
      </div>
      <div className="w-full lg:w-[70%] xl:w-[50%]">
        <div className="flex flex-col gap-6">
          {/* Bouton retour */}
          <div className="p-4">
            <BackButton />
          </div>
          
          {/* Post */}
          <Post post={postWithCorrectType} />
          
          {/* Informations supplémentaires */}
          <div className="bg-white rounded-[30px] shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              About this post
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">Posted by:</span>{' '}
                <Link 
                  href={`/profile/${post.user.username}`}
                  className="text-blue-500 hover:underline"
                >
                  {post.user.name && post.user.surname 
                    ? `${post.user.name} ${post.user.surname}` 
                    : post.user.username}
                </Link>
              </p>
              <p>
                <span className="font-medium">Likes:</span> {post.likes.length}
              </p>
              <p>
                <span className="font-medium">Comments:</span> {post._count.comments}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:block w-[30%]">
        <RightMenu />
      </div>
    </div>
  )
}

export default PostPage