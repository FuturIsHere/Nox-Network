// src/app/api/finalize-upload/route.ts (version simplifiée)
import { NextRequest, NextResponse } from 'next/server';
import { finalizeUpload } from '@/lib/uploadUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempFilename, targetType } = body;
    
    const result = await finalizeUpload(tempFilename, targetType);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Finalize upload API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finalize upload' }, 
      { status: 500 }
    );
  }
}