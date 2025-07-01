// app/api/messages/delete/[messageId]/route.ts

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { deleteMessageWithMedia } from "@/lib/action";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { userId: currentUserId } = auth();

    if (!currentUserId) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 }
      );
    }

    const { messageId } = params;

    console.log(`🗑️ API: Deleting message with media cleanup: ${messageId}`);

    // 🔥 NOUVEAU : Utiliser la fonction deleteMessageWithMedia qui gère automatiquement
    // la suppression des fichiers médias associés
    const result = await deleteMessageWithMedia(messageId);

    console.log(`✅ API: Message deleted successfully:`, {
      messageId,
      conversationDeleted: result.conversationDeleted,
      reason: result.reason
    });

    return NextResponse.json({
      success: true,
      conversationDeleted: result.conversationDeleted,
      reason: result.reason,
      messageId
    });

  } catch (error) {
    console.error("❌ API: Error deleting message with media:", error);
    
    // Gestion d'erreurs spécifiques
    if (error instanceof Error) {
      if (error.message === "Message not found") {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 }
        );
      }
      
      if (error.message === "You can only delete your own messages") {
        return NextResponse.json(
          { error: "You can only delete your own messages" },
          { status: 403 }
        );
      }

      if (error.message === "User is not authenticated!") {
        return NextResponse.json(
          { error: "User is not authenticated" },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}