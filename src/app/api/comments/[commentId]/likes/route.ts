import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    const commentId = parseInt(params.commentId)
    
    if (isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 })
    }

    // Verify that the comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true }
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Get all likes for this comment with user information
    const likes = await prisma.like.findMany({
      where: { 
        commentId: commentId,
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
      orderBy: {
        createdAt: 'desc' // Most recent likes first
      }
    })

    // Extract just the user data from the likes
    const likedUsers = likes.map(like => like.user)
    
    return NextResponse.json(likedUsers)
  } catch (error) {
    console.error('Error fetching comment liked users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}