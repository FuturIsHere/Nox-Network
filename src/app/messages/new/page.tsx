import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import NewConversation from "@/app/components/messaging/NewConversation";
import LefttMenu from "@/app/components/leftMenu/LeftMenu";

const NewConversationPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex gap-6">
      {/* Menu de gauche pour desktop */}
      <div className="hidden xl:block w-[20%]">
        <LefttMenu type={"home"}/>
      </div>
      
      {/* Zone principale */}
      <div className="w-full xl:w-[80%]">
        <NewConversation />
      </div>
    </div>
  );
};

export default NewConversationPage;