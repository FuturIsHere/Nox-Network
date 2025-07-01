// app/api/messages/[conversationId]/delete/route.ts

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { deleteConversationForUser } from "@/lib/action";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId: currentUserId } = auth();

    if (!currentUserId) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 }
      );
    }

    const { conversationId } = params;

    console.log(`[API] User ${currentUserId} attempting to delete conversation ${conversationId}`);

    // Utiliser la fonction existante qui gère la logique de suppression
    const result = await deleteConversationForUser(conversationId);

    console.log(`[API] Deletion result:`, result);

    return NextResponse.json({
      success: true,
      message: result.conversationDeleted 
        ? "Conversation supprimée définitivement" 
        : "Conversation masquée de votre liste",
      conversationDeleted: result.conversationDeleted,
      reason: result.reason
    });

  } catch (error) {
    console.error("[API] Error deleting conversation:", error);
    
    // Gestion d'erreurs spécifiques
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("access denied")) {
        return NextResponse.json(
          { error: "Conversation introuvable ou accès refusé" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Erreur lors de la suppression de la conversation" },
      { status: 500 }
    );
  }
}