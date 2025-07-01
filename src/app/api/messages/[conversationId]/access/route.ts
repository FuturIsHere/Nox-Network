// Créer ce fichier : /api/messages/[conversationId]/access/route.ts

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { checkConversationAccess, restoreAndAccessConversation } from "@/lib/action";

// GET : Vérifier l'accès à une conversation
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
    
    const accessCheck = await checkConversationAccess(conversationId);
    
    return NextResponse.json({
      hasAccess: accessCheck.hasAccess,
      wasDeleted: accessCheck.wasDeleted,
      conversationExists: !!accessCheck.conversation,
      deletedAt: accessCheck.wasDeleted ? accessCheck.deletedAt : null
    });
  } catch (error) {
    console.error("Error checking conversation access:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST : Restaurer l'accès à une conversation supprimée
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
    
    const result = await restoreAndAccessConversation(conversationId);
    
    return NextResponse.json({
      success: true,
      message: "Conversation access restored",
      conversation: {
        id: result.conversation.id,
        participants: result.conversation.participants
      }
    });
  } catch (error) {
    console.error("Error restoring conversation access:", error);
    
    if (error instanceof Error) {
      if (error.message === "Conversation not found") {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}