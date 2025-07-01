// src/app/api/messages/[conversationId]/mark-read/route.ts

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";

interface RouteParams {
  params: {
    conversationId: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId: currentUserId } = auth();
    const { conversationId } = params;

    if (!currentUserId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier l'accès à la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation non trouvée ou accès refusé" },
        { status: 404 }
      );
    }

    // Récupérer tous les messages non lus de cette conversation
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        senderId: {
          not: currentUserId // Seulement les messages des autres
        },
        NOT: {
          reads: {
            some: {
              userId: currentUserId
            }
          }
        }
      },
      select: {
        id: true
      }
    });

    console.log(`Found ${unreadMessages.length} unread messages in conversation ${conversationId}`);

    // Marquer tous ces messages comme lus
    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map(msg => ({
          messageId: msg.id,
          userId: currentUserId,
          readAt: new Date()
        })),
        skipDuplicates: true
      });

      console.log(`Marked ${unreadMessages.length} messages as read in conversation ${conversationId}`);
    }

    // Mettre à jour le lastReadAt du participant
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: conversationId,
        userId: currentUserId
      },
      data: {
        lastReadAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      markedCount: unreadMessages.length 
    });
  } catch (error) {
    console.error("Erreur lors du marquage comme lu:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}