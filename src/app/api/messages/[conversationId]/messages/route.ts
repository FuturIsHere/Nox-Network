
// src/app/api/messages/[conversationId]/messages/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getConversationMessages, sendMessageWithMedia } from "@/lib/action";

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Récupérer les paramètres de pagination depuis l'URL
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Valider les paramètres
    if (offset < 0 || limit < 1 || limit > 100) {
      return NextResponse.json({ 
        error: "Invalid pagination parameters. Offset must be >= 0 and limit between 1-100" 
      }, { status: 400 });
    }

    console.log(`Fetching messages for conversation ${params.conversationId} with offset: ${offset}, limit: ${limit}`);

    const messages = await getConversationMessages(params.conversationId, offset, limit);
    
    console.log(`Retrieved ${Array.isArray(messages) ? messages.length : 'unknown'} messages`);
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log("📬 API: Received message body:", body); // Debug log
    
    const { content, type = 'TEXT', mediaUrl } = body;

    // 🔥 MODIFIÉ : Permettre les messages avec seulement un média (sans texte)
    if (!content?.trim() && !mediaUrl) {
      return NextResponse.json({ error: "Message content or media is required" }, { status: 400 });
    }

    console.log("📤 API: Sending message to conversation:", params.conversationId); // Debug log
    console.log("📎 API: Media URL:", mediaUrl ? 'Present' : 'None');
    
    // 🔥 NOUVEAU : Utiliser la fonction sendMessageWithMedia pour gérer les médias
    const message = await sendMessageWithMedia(
      params.conversationId, 
      content?.trim() || '', // Permettre contenu vide si média présent
      mediaUrl, // URL du média (peut être undefined)
      type
    );
    
    console.log("✅ API: Message sent:", {
      id: message.id,
      type: message.type,
      hasMedia: !!message.mediaUrl,
      hasContent: !!message.content
    });
    
    return NextResponse.json(message);
  } catch (error) {
    console.error("❌ API: Error sending message:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 });
  }
}