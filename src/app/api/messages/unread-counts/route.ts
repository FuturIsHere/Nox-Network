// src/app/api/messages/unread-counts/route.ts

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/client";

export async function GET() {
  try {
    const { userId: currentUserId } = auth();

    if (!currentUserId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer les IDs des conversations supprimées par cet utilisateur
    const deletedConversationIds = await prisma.deletedConversation.findMany({
      where: {
        userId: currentUserId
      },
      select: {
        conversationId: true
      }
    });

    const deletedIds = deletedConversationIds.map(d => d.conversationId);

    // Récupérer toutes les conversations de l'utilisateur (non supprimées)
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: currentUserId
          }
        },
        id: {
          notIn: deletedIds
        }
      },
      select: {
        id: true,
        messages: {
          where: {
            senderId: {
              not: currentUserId
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
        }
      }
    });

    // Construire l'objet des compteurs
    const unreadCounts: Record<string, number> = {};
    conversations.forEach(conv => {
      unreadCounts[conv.id] = conv.messages.length;
    });

    console.log(`📊 Compteurs de messages non lus pour ${currentUserId}:`, unreadCounts);
    
    return NextResponse.json(unreadCounts);
  } catch (error) {
    console.error("Erreur lors du calcul des compteurs:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}