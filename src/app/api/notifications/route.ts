// app/api/notifications/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/client'

export async function GET() {
  try {
    // Await auth() - fix for Next.js 15
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching notifications for user:', userId)

    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId,
      },
      include: {
        triggeredBy: {
          select: {
            id: true,
            username: true,
            avatar: true,
            name: true,
            surname: true,
          },
        },
        post: {
          select: {
            id: true,
            desc: true,
            img: true,
          },
        },
        comment: {
          select: {
            id: true,
            desc: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    console.log(`Found ${notifications.length} notifications`)
    return NextResponse.json(notifications)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Route pour marquer toutes les notifications comme lues
export async function PATCH() {
  try {
    // Await auth() - fix for Next.js 15
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Marking all notifications as read for user:', userId)

    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        read: false,
      },
      data: {
        read: true,
      },
    })

    console.log(`Marked ${result.count} notifications as read`)
    return NextResponse.json({ 
      success: true, 
      updatedCount: result.count 
    })
  } catch (error) {
    console.error('Error marking notifications as read:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}