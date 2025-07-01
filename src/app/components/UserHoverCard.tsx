'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { User } from "@/generated/prisma"

type UserHoverData = {
    id: string
    username: string
    name?: string | null
    surname?: string | null
    avatar?: string | null
    _count: {
        followers: number
        followings: number
    }
}

type UserHoverCardProps = {
    username?: string
    user?: User & { _count?: { followers: number; followings: number } }
    children: React.ReactNode
}

export default function UserHoverCard({ username, user, children }: UserHoverCardProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [userData, setUserData] = useState<UserHoverData | null>(user as UserHoverData || null)
    const [loading, setLoading] = useState(false)
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null)

    const fetchUserData = async () => {
        if (userData || loading || !username) return

        setLoading(true)
        try {
            const response = await fetch(`/api/user/${username}`)
            if (response.ok) {
                const data = await response.json()
                setUserData(data)
            }
        } catch (error) {
            console.error('Error fetching user data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleMouseEnter = () => {
        const timeout = setTimeout(() => {
            setIsHovered(true)
            if (!userData) {
                fetchUserData()
            }
        }, 500) // Délai de 500ms avant d'afficher la carte
        setHoverTimeout(timeout)
    }

    const handleMouseLeave = () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout)
            setHoverTimeout(null)
        }
        setIsHovered(false)
    }

    return (
        <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {isHovered && (
                <div className="absolute top-full left-0 z-50 w-80 bg-[#f5f5f7]/45 backdrop-blur-[9.4px] rounded-2xl shadow-2xl border-[1px] border-solid border-[#e3e3e3] p-6 animate-in fade-in-0 zoom-in-95 duration-200">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : userData ? (
                        <>
                            {/* Header avec avatar et nom */}
                            <div className="flex items-start gap-4">
                                <div className="relative mb-2">
                                    <Image
                                        src={userData.avatar || "/noAvatar.png"}
                                        alt={userData.username}
                                        width={50} height={50}
                                        className="w-13 h-13 rounded-full object-cover"
                                    />
                                </div>
                                <div className="flex flex-col min-w-0 relative mb-5">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-[600] text-[17px] text-black">
                                            {userData.name && userData.surname
                                                ? `${userData.name} ${userData.surname}`
                                                : userData.username}
                                        </h3>
                                    </div>
                                    <div className="flex min-w-0 relative mb-2">
                                    <a className="text-gray-600 text-left font-[400] text-sm">@{userData.username}</a>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex gap-6 mb-5 items-center">
                                <div className="text-center">
                                    <div className="font-bold text-black text-[14px]">{userData._count?.followings || 0} <a className='font-[400] text-[#86868b]'>followers</a></div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-black  text-[14px]">{userData._count?.followers || 0} <a className='font-[400] text-[#86868b]'>followings</a></div>
                                </div>
                            </div>

                            {/* Action button */}
                            <div className='flex justify-center items-center'>
                            <a
                                href={`/profile/${userData.username}`}
                                className="text-sm text-center bg-black text-white font-medium py-2 px-4 rounded-[99px]"
                            >
                                View profile
                            </a>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4 text-gray-500">
                            User not found
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}