"use client"

import { switchBlock, switchFollow } from "@/lib/action";
import { useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Send } from "lucide-react";

const UserInfoCardInteraction = ({
    userId,
    isUserBlocked,
    isFollwing,
    isFollwingSent,
}: {
    userId: string;
    isUserBlocked: boolean;
    isFollwing: boolean;
    isFollwingSent: boolean;
}) => {
    const router = useRouter();
    const { user: currentUser } = useUser();
    const [userState, setUserState] = useState({
        following: isFollwing,
        blocked: isUserBlocked,
        followingRequestSent: isFollwingSent,
    });

    const follow = async () => {
        switchOptimisticState("follow")
        try {
            await switchFollow(userId);
            setUserState(prev => ({
                ...prev,
                following: prev.following && false,
                followingRequestSent: !prev.following && !prev.followingRequestSent ? true : false,
            }));
        } catch (err) {
            console.error("Error following user:", err);
        }
    }

    const block = async () => {
        switchOptimisticState("block");
        try {
            await switchBlock(userId);
            setUserState((prev) => ({
                ...prev, 
                blocked: !prev.blocked,
            }));
        } catch (err) {
            console.error("Error blocking user:", err);
        }
    };

    const handleSendMessage = async () => {
        if (!currentUser?.id) return;

        try {
            // Vérifier s'il existe déjà une conversation entre les deux utilisateurs
            const response = await fetch(`/api/messages/check-conversation?otherUserId=${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.conversationId) {
                    // Une conversation existe déjà, rediriger vers celle-ci
                    router.push(`/messages/${data.conversationId}`);
                } else {
                    // Aucune conversation n'existe, rediriger vers la création d'une nouvelle conversation
                    const encodedUserId = encodeURIComponent(userId);
                    router.push(`/messages/new/${encodedUserId}`);
                }
            } else {
                // En cas d'erreur, rediriger vers la création d'une nouvelle conversation
                const encodedUserId = encodeURIComponent(userId);
                router.push(`/messages/new/${encodedUserId}`);
            }
        } catch (error) {
            console.error("Error checking conversation:", error);
            // En cas d'erreur, rediriger vers la création d'une nouvelle conversation
            const encodedUserId = encodeURIComponent(userId);
            router.push(`/messages/new/${encodedUserId}`);
        }
    };

    const [optimisticState, switchOptimisticState] = useOptimistic(
        userState, 
        (state, value: "follow" | "block") => value === "follow" ? {
            ...state,
            following: state.following && false,
            followingRequestSent: !state.following && !state.followingRequestSent ? true : false,
        } : { 
            ...state, 
            blocked: !state.blocked 
        }
    );

    return (
        <div className="flex flex-col gap-3">
            {/* Boutons Follow et Send Message côte à côte */}
            <div className="flex gap-2">
                <form action={follow} className="flex-1">
                    <button 
                        type="submit"
                        className="w-full bg-[#0071e3] text-white p-2 rounded-[99px] text-sm font-medium hover:bg-[#0056b3] transition-colors"
                    >
                        {optimisticState.following 
                            ? "Following" 
                            : optimisticState.followingRequestSent 
                                ? "Request Sent" 
                                : "Follow"
                        }
                    </button>
                </form>
                
         <button
    onClick={handleSendMessage}
    className="flex-1 bg-black text-white p-2 rounded-[99px] text-sm font-medium hover:bg-gray-700 transition-colors"
>
    <div className="flex w-full justify-center items-center gap-2">
        <span>Send Message</span>
        <Send size={16}/>
    </div>
</button>
            </div>

            {/* Bouton Block */}
            <form action={block} className="self-center">
                <button type="submit" className="text-sm">
                    <span className="text-red-400 hover:text-red-600 transition-colors">
                        {optimisticState.blocked ? "Unblock User" : "Block User"}
                    </span>
                </button>
            </form>
        </div>
    );
};

export default UserInfoCardInteraction;