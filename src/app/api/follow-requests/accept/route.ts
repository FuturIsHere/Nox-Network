// src/app/api/follow-requests/accept/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { acceptFollowRequest } from '@/lib/action'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get('userId') as string
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    await acceptFollowRequest(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error accepting follow request:', error)
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 })
  }
}