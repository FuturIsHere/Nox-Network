import prisma from '@/lib/client'
import { notFound } from 'next/navigation'
import PostInteraction from '../feed/PostInteraction'

async function getLikedUsers(postId: number) {
  try {
    const likes = await prisma.like.findMany({
      where: { postId },
      include: {
        user: {
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
    
    return likes.map(like => like.user)
  } catch (error) {
    console.error("Error fetching liked users:", error)
    return []
  }
}

export default async function PostInteractionWrapper({ postId, likes, commentNumber }: { 
  postId: number, 
  likes: string[], 
  commentNumber: number 
}) {
  // Fetch liked users on the server side for initial render
  const initialLikedUsers = await getLikedUsers(postId)
  
  return (
    <PostInteraction 
      postId={postId} 
      likes={likes} 
      commentNumber={commentNumber} 
      initialLikedUsers={initialLikedUsers}
    />
  )
}