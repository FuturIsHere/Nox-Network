// src/app/api/follow-requests/decline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { declineFollowRequest } from '@/lib/action'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get('userId') as string
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    await declineFollowRequest(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error declining follow request:', error)
    return NextResponse.json({ error: 'Failed to decline request' }, { status: 500 })
  }
}