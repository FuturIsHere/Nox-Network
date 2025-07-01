import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import MessagingSystem from "@/app/components/messaging/MessagingSystem";
import { getUserConversationsUpdated } from "@/lib/action";
import LefttMenu from "../components/leftMenu/LeftMenu";

const MessagesPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // CHANGEMENT IMPORTANT : Utiliser getUserConversationsUpdated au lieu de getUserConversations
  // Cette fonction exclut automatiquement les conversations supprimées par l'utilisateur
  const conversations = await getUserConversationsUpdated();

  return (
    <div className="flex gap-6">
      {/* Menu de gauche pour desktop */}
      <div className="hidden xl:block w-[20%]">
        <LefttMenu type={"home"}/>
      </div>
      
      {/* Zone principale des messages */}
      <div className="w-full xl:w-[80%]">
        <MessagingSystem initialConversations={conversations} />
      </div>
    </div>
  );
};

export default MessagesPage;