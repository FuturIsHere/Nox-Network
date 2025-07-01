// Créer ce fichier : /api/messages/[conversationId]/restore/route.ts

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { restoreConversationForUser } from "@/lib/action";
import prisma from "@/lib/client";

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { conversationId } = params;
    
    console.log(`[API] Restoring conversation ${conversationId} for user ${userId}`);
    
    const result = await restoreConversationForUser(conversationId);
    
    if (result.restored) {
      console.log(`[API] Conversation ${conversationId} successfully restored for user ${userId}`);
      return NextResponse.json({
        success: true,
        message: "Conversation restored successfully",
        conversationId: conversationId
      });
    } else {
      console.log(`[API] Conversation ${conversationId} was not deleted for user ${userId}`);
      return NextResponse.json({
        success: true,
        message: "Conversation was not deleted",
        conversationId: conversationId
      });
    }
  } catch (error) {
    console.error(`[API] Error restoring conversation:`, error);
    
    if (error instanceof Error) {
      if (error.message === "Conversation no longer exists") {
        return NextResponse.json({ 
          error: "Conversation no longer exists" 
        }, { status: 404 });
      }
    }
    
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// GET : Vérifier le statut de suppression d'une conversation
export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { conversationId } = params;
    
    // Vérifier si la conversation est supprimée pour cet utilisateur
    const deletedConversation = await prisma.deletedConversation.findUnique({
      where: {
        userId_conversationId: {
          userId: userId,
          conversationId: conversationId
        }
      }
    });

    return NextResponse.json({
      isDeleted: !!deletedConversation,
      deletedAt: deletedConversation?.deletedAt?.toISOString() || null
    });
  } catch (error) {
    console.error(`[API] Error checking conversation deletion status:`, error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}