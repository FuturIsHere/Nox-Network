"use client"

import { FollowRequest, User } from "@/generated/prisma"
import { acceptFollowRequest, declineFollowRequest } from "@/lib/action";
import Image from "next/image"
import { useOptimistic, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type RequestWithUser = FollowRequest & {
    sender: User;
};

const FriendRequestsList = ({ requests }: { requests: RequestWithUser[] }) => {
    const [requestState, setRequestState] = useState(requests);
    const router = useRouter();

    const accept = async (requestId: number, userId: string) => {
        removeOptimisticRequest(requestId)
        try {
            await acceptFollowRequest(userId)
            setRequestState(prev => prev.filter((req) => req.id !== requestId))
            
            // Déclencher une actualisation pour mettre à jour les notifications
            setTimeout(() => {
                router.refresh()
            }, 300)
        } catch (err) { 
            console.error('Erreur lors de l\'acceptation de la demande:', err)
        }
    };

    const decline = async (requestId: number, userId: string) => {
        removeOptimisticRequest(requestId)
        try {
            await declineFollowRequest(userId)
            setRequestState(prev => prev.filter((req) => req.id !== requestId))
            
            // Déclencher une actualisation pour mettre à jour les notifications
            setTimeout(() => {
                router.refresh()
            }, 300)
        } catch (err) { 
            console.error('Erreur lors du refus de la demande:', err)
        }
    };

    const [optimisticRequests, removeOptimisticRequest] = useOptimistic(
        requestState, 
        (state, value: number) => state.filter(req => req.id !== value)
    );

    // Cacher le container parent quand il n'y a plus de demandes
    useEffect(() => {
        if (optimisticRequests.length === 0) {
            const container = document.querySelector('[data-friend-requests-container]');
            if (container) {
                (container as HTMLElement).style.display = 'none';
            }
        }
    }, [optimisticRequests.length]);

    // Écouter les événements de focus de la fenêtre pour actualiser
    useEffect(() => {
        const handleFocus = () => {
            // Actualiser la page quand l'utilisateur revient sur l'onglet
            // Cela aidera à synchroniser les notifications
            router.refresh();
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [router]);
    
    return (
        <div>
            {optimisticRequests.map((request) => (
                <div className="pb-3" key={request.id}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Image 
                                src={request.sender.avatar || "/noAvatar.png"} 
                                alt="" 
                                className="w-10 h-10 rounded-full object-cover" 
                                width={40} 
                                height={40} 
                            />
                            <span className="text-[15px] font-[500]">
                                {(request.sender.name && request.sender.surname) 
                                    ? request.sender.name + " " + request.sender.surname 
                                    : request.sender.username}
                            </span>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <form action={() => accept(request.id, request.sender.id)}>
                                <button>
                                    <Image 
                                        src="/accept.png" 
                                        alt="" 
                                        className="cursor-pointer" 
                                        width={20} 
                                        height={20} 
                                    />
                                </button>
                            </form>
                            <form action={() => decline(request.id, request.sender.id)}>
                                <button>
                                    <Image 
                                        src="/reject.png" 
                                        alt="" 
                                        className="cursor-pointer" 
                                        width={20} 
                                        height={20} 
                                    />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FriendRequestsList