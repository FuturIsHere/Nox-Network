import { NextResponse } from 'next/server';
import prisma from '@/lib/client';

export async function GET() {
  try {
    // Récupérer toutes les stories non expirées
    const stories = await prisma.story.findMany({
      where: {
        expiresAt: {
          gt: new Date(), // Uniquement les stories qui n'ont pas encore expiré
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Error fetching stories:', error);
    return NextResponse.json({ message: 'Error fetching stories' }, { status: 500 });
  }
}