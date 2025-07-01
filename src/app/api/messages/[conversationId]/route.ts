// 🔧 CORRECTION : /api/messages/[conversationId]/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getConversationMessages, checkConversationAccess } from "@/lib/action";
import prisma from "@/lib/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log('[API] Loading conversation:', params.conversationId, 'for user:', userId);
    
    // 🔧 NOUVEAU : Utiliser la fonction de vérification d'accès améliorée
    const accessCheck = await checkConversationAccess(params.conversationId);

    if (!accessCheck.conversation) {
      console.log('[API] Conversation not found:', params.conversationId);
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // 🔧 NOUVEAU : Si la conversation est supprimée pour cet utilisateur
    if (accessCheck.wasDeleted) {
      console.log('[API] Conversation was deleted by user:', userId);
      return NextResponse.json({ 
        error: "Conversation was deleted",
        wasDeleted: true,
        deletedAt: accessCheck.deletedAt
      }, { status: 403 });
    }

    const conversation = accessCheck.conversation;

    // Récupérer les messages
    const messages = await getConversationMessages(params.conversationId);
    console.log('[API] Loaded', messages.length, 'messages from DB');
    
    // Transformer les données pour correspondre au format attendu
    const otherUser = conversation.participants.find(p => p.userId !== userId)?.user;
    
    if (!otherUser) {
      console.log('[API] Other user not found in conversation');
      return NextResponse.json({ error: "Other user not found" }, { status: 404 });
    }

    const conversationData = {
      id: conversation.id,
      lastMessage: messages.length > 0 ? messages[messages.length - 1].content : '',
      lastMessageAt: conversation.lastMessageAt?.toISOString() || new Date().toISOString(),
      unreadCount: 0,
      isOnline: false,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        name: otherUser.name,
        surname: otherUser.surname,
        avatar: otherUser.avatar
      }
    };

    const response = {
      conversation: conversationData,
      messages: messages
    };
    
    console.log('[API] Successfully loaded conversation:', params.conversationId);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] Error fetching conversation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}