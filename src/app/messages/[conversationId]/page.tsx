// Remplacer le contenu de /messages/[conversationId]/page.tsx

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getConversationMessages, getUserConversationsUpdated, checkConversationAccess, restoreAndAccessConversation } from "@/lib/action";
import ConversationView from "@/app/components/messaging/ConversationView";
import LefttMenu from "@/app/components/leftMenu/LeftMenu";

interface ConversationPageProps {
  params: {
    conversationId: string;
  };
}

const ConversationPage = async ({ params }: ConversationPageProps) => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { conversationId } = params;

  try {
    console.log(`[ConversationPage] User ${userId} accessing conversation ${conversationId}`);

    // 🔧 NOUVEAU : Utiliser la fonction de vérification d'accès
    const accessCheck = await checkConversationAccess(conversationId);

    if (!accessCheck.conversation) {
      console.log(`[ConversationPage] Conversation ${conversationId} not found`);
      redirect("/messages");
    }

    // 🔧 NOUVEAU : Si la conversation était supprimée, proposer de la restaurer ou rediriger
    if (accessCheck.wasDeleted) {
      console.log(`[ConversationPage] Conversation ${conversationId} was deleted by user ${userId}`);
      
      // Option 1 : Restaurer automatiquement et continuer
      try {
        const restoreResult = await restoreAndAccessConversation(conversationId);
        console.log(`[ConversationPage] Conversation ${conversationId} restored automatically`);
        // Continuer avec la conversation restaurée
      } catch (restoreError) {
        console.error(`[ConversationPage] Failed to restore conversation:`, restoreError);
        redirect("/messages");
      }
      
      // Option 2 : Rediriger vers une page de confirmation (commenté)
      // redirect(`/messages/restore/${conversationId}`);
    }

    const conversation = accessCheck.conversation;

    // Récupérer les messages de la conversation
    const messages = await getConversationMessages(conversationId, 0, 20);

    // Récupérer toutes les conversations (en excluant les supprimées)
    const conversations = await getUserConversationsUpdated();

    // Trouver l'autre utilisateur dans la conversation
    const otherUser = conversation.participants.find(p => p.userId !== userId)?.user;

    if (!otherUser) {
      console.log(`[ConversationPage] Other user not found in conversation ${conversationId}`);
      redirect("/messages");
    }

    const conversationData = {
      id: conversation.id,
      lastMessage: messages[messages.length - 1]?.content || '',
      lastMessageAt: conversation.lastMessageAt?.toISOString() || new Date().toISOString(),
      unreadCount: 0,
      isOnline: false,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        name: otherUser.name ?? undefined,
        surname: otherUser.surname ?? undefined,
        avatar: otherUser.avatar ?? undefined
      }
    };

    console.log(`[ConversationPage] Successfully loaded conversation ${conversationId}`);

    return (
      <div className="flex gap-6">
        {/* Menu de gauche pour desktop */}
        <div className="hidden xl:block w-[20%]">
          <LefttMenu type={"home"}/>
        </div>
        
        {/* Zone principale */}
        <div className="w-full xl:w-[80%]">
          <ConversationView 
            conversation={conversationData}
            initialMessages={messages}
            allConversations={conversations}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[ConversationPage] Error loading conversation:", error);
    
    // Log détaillé pour debug
    if (error instanceof Error) {
      console.error("[ConversationPage] Error message:", error.message);
      console.error("[ConversationPage] Error stack:", error.stack);
    }
    
    redirect("/messages");
  }
};

export default ConversationPage;