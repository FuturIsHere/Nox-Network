// Make sure this file is in /app/api/posts/[postId]/likes/route.ts
import { NextResponse } from 'next/server'
import prisma from '@/lib/client'

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // Await the params - fix for Next.js 15
    const { postId: postIdParam } = await params
    const postId = parseInt(postIdParam)
    
    if (isNaN(postId)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })
    }

    // Vérifier que le post existe
    const post = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Récupérer les likes avec les informations des utilisateurs
    const likes = await prisma.like.findMany({
      where: { 
        postId: postId,
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

    // Extraire juste les informations des utilisateurs
    const likedUsers = likes.map(like => like.user)
    
    return NextResponse.json(likedUsers)
  } catch (error) {
    console.error('Error fetching liked users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}