// app/api/notifications/[id]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/client'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notificationId = params.id

    console.log('Deleting notification:', notificationId, 'for user:', userId)

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId,
      },
    })

    if (!notification) {
      return NextResponse.json({ 
        error: 'Notification not found or not authorized' 
      }, { status: 404 })
    }

    // Supprimer la notification
    await prisma.notification.delete({
      where: {
        id: notificationId,
      },
    })

    console.log('Notification deleted successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}