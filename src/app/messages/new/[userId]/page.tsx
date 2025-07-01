import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import TempConversation from "@/app/components/messaging/TempConversation";
import LefttMenu from "@/app/components/leftMenu/LeftMenu";

interface TempConversationPageProps {
  params: {
    userId: string;
  };
}

const TempConversationPage = async ({ params }: TempConversationPageProps) => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Décoder l'ID utilisateur
  const decodedUserId = decodeURIComponent(params.userId);

  // Vérifier que l'utilisateur ne tente pas de démarrer une conversation avec lui-même
  if (userId === decodedUserId) {
    redirect("/messages");
  }

  return (
    <div className="flex gap-6">
      {/* Menu de gauche pour desktop */}
      <div className="hidden xl:block w-[20%]">
        <LefttMenu type={"home"}/>
      </div>
      
      {/* Zone principale */}
      <div className="w-full xl:w-[80%]">
        <TempConversation otherUserId={decodedUserId} />
      </div>
    </div>
  );
};

export default TempConversationPage;