import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get('otherUserId');

    if (!otherUserId) {
      return NextResponse.json({ error: "ID utilisateur manquant" }, { status: 400 });
    }

    console.log('[API] Checking conversation between', userId, 'and', otherUserId);

    // 🔧 NOUVEAU : Vérifier s'il existe une conversation entre les deux utilisateurs
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            participants: {
              some: {
                userId: userId
              }
            }
          },
          {
            participants: {
              some: {
                userId: otherUserId
              }
            }
          }
        ]
      },
      select: {
        id: true,
        lastMessageAt: true
      }
    });

    if (existingConversation) {
      // 🔧 NOUVEAU : Vérifier si l'utilisateur actuel a supprimé cette conversation
      const deletedByCurrentUser = await prisma.deletedConversation.findUnique({
        where: {
          userId_conversationId: {
            userId: userId,
            conversationId: existingConversation.id
          }
        }
      });

      console.log('[API] Conversation exists:', existingConversation.id, 'deleted by user:', !!deletedByCurrentUser);

      return NextResponse.json({ 
        conversationId: existingConversation.id,
        exists: true,
        wasDeleted: !!deletedByCurrentUser,
        deletedAt: deletedByCurrentUser?.deletedAt?.toISOString() || null,
        lastMessageAt: existingConversation.lastMessageAt?.toISOString()
      });
    } else {
      console.log('[API] No conversation found between users');
      return NextResponse.json({ 
        conversationId: null,
        exists: false,
        wasDeleted: false
      });
    }

  } catch (error) {
    console.error("[API] Erreur lors de la vérification de la conversation:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}