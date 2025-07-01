// app/api/notifications/unread-count/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/client'

export async function GET() {
  try {
    // Await the auth() function - fix for Next.js 15
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching unread count for user:', userId)

    const unreadCount = await prisma.notification.count({
      where: {
        userId: userId,
        read: false,
      },
    })

    console.log(`Found ${unreadCount} unread notifications`)
    return NextResponse.json({ count: unreadCount })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}