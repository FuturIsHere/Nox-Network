// src/app/profile/[username]/requests/RequestsPageClient.tsx
"use client"

import { FollowRequest, User } from "@/generated/prisma"
import Link from "next/link"
import Image from "next/image"
import ProfileTabBar from '@/app/components/ProfileTabBar'
import RightMenu from '@/app/components/rightMenu/RightMenu'
import LeftMenu from '@/app/components/leftMenu/LeftMenu'
import { useOptimistic, startTransition, useState } from "react"
import { useRouter } from 'next/navigation'

type RequestWithUser = FollowRequest & {
    sender: User;
};

type UserData = {
    id: string;
    username: string;
    avatar: string | null;
};

type Props = {
    user: UserData;
    initialRequests: RequestWithUser[];
}

export default function RequestsPageClient({ user, initialRequests }: Props) {
    const [processingRequests, setProcessingRequests] = useState<Set<number>>(new Set())
    const router = useRouter()

    const accept = async (requestId: number, userId: string) => {
        // Éviter les doubles clics
        if (processingRequests.has(requestId)) return

        setProcessingRequests(prev => new Set(prev).add(requestId))

        startTransition(async () => {
            // Suppression optimiste AVANT l'appel API
            removeOptimisticRequest(requestId)

            try {
                const formData = new FormData()
                formData.append('userId', userId)

                const response = await fetch('/api/follow-requests/accept', {
                    method: 'POST',
                    body: formData,
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to accept request')
                }

                // Forcer un refresh des données côté serveur
                router.refresh()

            } catch (err) {
                console.error('Erreur lors de l\'acceptation:', err)
                // En cas d'erreur, recharger la page pour restaurer l'état correct
                window.location.reload()
            } finally {
                setProcessingRequests(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(requestId)
                    return newSet
                })
            }
        })
    };

    const decline = async (requestId: number, userId: string) => {
        // Éviter les doubles clics
        if (processingRequests.has(requestId)) return

        setProcessingRequests(prev => new Set(prev).add(requestId))

        startTransition(async () => {
            // Suppression optimiste AVANT l'appel API
            removeOptimisticRequest(requestId)

            try {
                const formData = new FormData()
                formData.append('userId', userId)

                const response = await fetch('/api/follow-requests/decline', {
                    method: 'POST',
                    body: formData,
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to decline request')
                }

                // Forcer un refresh des données côté serveur
                router.refresh()

            } catch (err) {
                console.error('Erreur lors du refus:', err)
                // En cas d'erreur, recharger la page pour restaurer l'état correct
                window.location.reload()
            } finally {
                setProcessingRequests(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(requestId)
                    return newSet
                })
            }
        })
    };

    const [optimisticRequests, removeOptimisticRequest] = useOptimistic(
        initialRequests,
        (state, requestId: number) => {
            console.log('Removing request optimistically:', requestId)
            console.log('Current state:', state.map(r => r.id))
            const newState = state.filter(req => req.id !== requestId)
            console.log('New state:', newState.map(r => r.id))
            return newState
        }
    );

    console.log('Rendering with optimistic requests:', optimisticRequests.map(r => r.id))

    return (
        <div>


            <div className="flex justify-center">
                <Link href={`/profile/${user.username}`} className="inline-block">
                    <Image
                        src={user.avatar || "/noAvatar.png"}
                        alt=""
                        width={70}
                        height={70}
                        className="rounded-full object-cover object-top w-[70px] h-[70px]  left-0 right-0 m-auto -bottom-6 z-10 mb-5"
                    />
                </Link>
            </div>
            <h1 className="text-xl font-bold mb-10 text-center">
                Friend Requests for @{user.username}
            </h1>

            <ProfileTabBar username={user.username} />

            {optimisticRequests.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 mt-6">
                    {optimisticRequests.map((request) => (
                        <div key={request.id} className="p-4 bg-white rounded-[30px] shadow-md">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Link href={`/profile/${request.sender.username}`}>
                                        <div className="relative">
                                            <img
                                                src={request.sender.avatar || '/default-avatar.png'}
                                                alt={request.sender.username}
                                                className="rounded-full object-cover w-12 h-12 left-0 right-0 m-auto -bottom-5 ring-2 ring-white z-10"
                                            />
                                        </div>
                                    </Link>
                                    <div className="ml-1">
                                        <Link href={`/profile/${request.sender.username}`} className="font-medium hover:underline">
                                            <span className="text-[15px] font-[500]">
                                                {(request.sender.name && request.sender.surname)
                                                    ? request.sender.name + " " + request.sender.surname
                                                    : request.sender.username}
                                            </span>
                                        </Link>
                                        <p className="text-gray-500 text-sm">@{request.sender.username}</p>
                                        <p className="text-gray-400 text-xs">
                                            {new Date(request.createdAt).toLocaleDateString('en-EN', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => accept(request.id, request.sender.id)}
                                        disabled={processingRequests.has(request.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${processingRequests.has(request.id)
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-blue-500 hover:bg-blue-600'
                                            } text-white`}
                                    >
                                        <Image
                                            src="/accept2.png"
                                            alt="Accept"
                                            width={16}
                                            height={16}
                                        />
                                        {processingRequests.has(request.id) ? 'Processing...' : 'Accept'}
                                    </button>
                                    <button
                                        onClick={() => decline(request.id, request.sender.id)}
                                        disabled={processingRequests.has(request.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${processingRequests.has(request.id)
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-black hover:bg-gray-600'
                                            } text-white`}
                                    >
                                        <Image
                                            src="/reject2.png"
                                            alt="Decline"
                                            width={16}
                                            height={16}
                                        />
                                        {processingRequests.has(request.id) ? 'Processing...' : 'Decline'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-[50px] font-[700] text-[#d0d0d0] mt-20">
                    No friend requests
                </div>
            )}


        </div>
    )
}