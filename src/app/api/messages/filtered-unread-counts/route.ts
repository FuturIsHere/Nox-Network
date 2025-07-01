// src/app/api/messages/filtered-unread-counts/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getUnreadCounts } from "@/lib/action";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const excludeConversationId = searchParams.get('exclude');

    console.log(`🔍 [API] Récupération compteurs filtrés pour user ${userId}, exclusion: ${excludeConversationId}`);
    
    const allCounts = await getUnreadCounts();
    
    // Filtrer la conversation active si spécifiée
    const filteredCounts = excludeConversationId 
      ? Object.fromEntries(
          Object.entries(allCounts).filter(([id]) => id !== excludeConversationId)
        )
      : allCounts;

    console.log(`📊 [API] Compteurs filtrés retournés:`, {
      original: allCounts,
      filtered: filteredCounts,
      excluded: excludeConversationId
    });

    return NextResponse.json(filteredCounts);
  } catch (error) {
    console.error("❌ [API] Erreur lors de la récupération des compteurs filtrés:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}