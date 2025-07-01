
// src/app/api/messages/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getUserConversationsUpdated, createConversationWithMediaMessage } from "@/lib/action";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(`[API] Fetching conversations for user: ${userId}`);
    
    // Utiliser la nouvelle fonction qui exclut les conversations supprimées
    const conversations = await getUserConversationsUpdated();
    
    console.log(`[API] Found ${conversations.length} conversations for user ${userId}`);
    console.log(`[API] Conversation IDs:`, conversations.map(c => c.id));
    
    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log("📬 API: Received conversation creation body:", body); // Debug log
    
    const { otherUserId, firstMessage, mediaUrl } = body;

    if (!otherUserId) {
      return NextResponse.json({ error: "otherUserId is required" }, { status: 400 });
    }

    // 🔥 MODIFIÉ : Permettre création avec message ET/OU média
    if (!firstMessage?.trim() && !mediaUrl) {
      return NextResponse.json({ error: "First message or media is required" }, { status: 400 });
    }

    console.log("📤 API: Creating conversation with media support:", {
      otherUserId,
      hasMessage: !!firstMessage?.trim(),
      hasMedia: !!mediaUrl
    });
    
    // 🔥 NOUVEAU : Utiliser la fonction createConversationWithMediaMessage
    const result = await createConversationWithMediaMessage(
      otherUserId, 
      firstMessage?.trim() || '', // Permettre message vide si média présent
      mediaUrl // URL du média (peut être undefined)
    );
    
    console.log("✅ API: Conversation created with media support:", {
      id: result.id,
      messageId: result.message?.id,
      hasMedia: !!result.message?.mediaUrl
    });
    
    return NextResponse.json(result);

  } catch (error) {
    console.error("❌ API: Error creating conversation:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 });
  }
}