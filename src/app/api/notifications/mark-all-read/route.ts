// app/api/notifications/mark-all-read/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/client'

export async function PATCH() {
  try {
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