import prisma from '@/lib/client'
import { notFound } from 'next/navigation'
import LikesModal from './LikesModal'

type Props = {
  postId: number
}

export default async function LikesModalWrapper({ postId }: Props) {
  // Fetch post to ensure it exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
    },
  })

  if (!post) return notFound()

  // Get all likes for this post with user information
  const likes = await prisma.like.findMany({
    where: { 
      postId: post.id,
    },
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

  // Extract just the user data from the likes
  const likedUsers = likes.map(like => like.user)
  
  return (
    <LikesModal 
      likeCount={likes.length} 
      likedUsers={likedUsers} 
    />
  )
}