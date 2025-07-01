'use client'

import { useState, useTransition } from 'react'
import Image from "next/image"
import Link from "next/link"
import { switchFollow } from "@/lib/action"
import { useOptimistic } from 'react'

type User = {
  id: string
  username: string
  name?: string | null
  surname?: string | null
  avatar?: string | null
}

type Props = {
  followingCount: number
  username: string
  followings: User[]
  currentUserId?: string // ID de l'utilisateur connecté
}

export default function FollowingsModal({ followingCount, username, followings, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [followingsState, setFollowingsState] = useState(followings)
  const [isPending, startTransition] = useTransition()

  const handleClose = () => setOpen(false)

  const handleUnfollow = async (userId: string) => {
    startTransition(() => {
      removeOptimisticFollowing(userId)
    })
    
    try {
      await switchFollow(userId)
      setFollowingsState(prev => prev.filter(f => f.id !== userId))
    } catch (err) {
      console.error('Erreur lors de l\'unfollow:', err)
      // Optionally revert the optimistic update on error
      setFollowingsState(followings)
    }
  }

  const [optimisticFollowings, removeOptimisticFollowing] = useOptimistic(
    followingsState,
    (state, userId: string) => state.filter(f => f.id !== userId)
  )

  return (
    <div>
      <div
        className="flex flex-col items-center cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <span className="font-[600]">{optimisticFollowings.length}</span>
        <span className="text-sm">
          Following
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[9.4px] flex items-center justify-center z-50"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-[30px] shadow-xl p-6 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-2 right-3 text-gray-500"
            >
              <Image src="/reject.png" alt="" className="cursor-pointer" width={30} height={30} />
            </button>
            <h2 className="text-lg font-bold mb-6 text-center">Following</h2>
            <div className="overflow-hidden max-h-[410px]">
              <ul className="space-y-4 max-h-64 overflow-y-auto">
                {optimisticFollowings.map((f) => (
                  <li key={f.id} className="flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-3">
                      <Link href={`/profile/${f.username}`}>
                        <img
                          src={f.avatar || '/noAvatar.png'}
                          alt={f.username}
                          className="w-10 h-10 rounded-full"
                        />
                      </Link>
                      <Link href={`/profile/${f.username}`}>
                        <div className='flex flex-col'>
                          <span className='font-[600]'>{f.username}</span>
                          <span className='text-[#737373]'>
                            {(f.name && f.surname) ? `${f.name} ${f.surname}` : f.username}
                          </span>
                        </div>
                      </Link>
                    </div>
                    {currentUserId && (
                      <button
                        onClick={() => handleUnfollow(f.id)}
                        disabled={isPending}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-3 py-1 rounded-full transition-colors disabled:opacity-50"
                      >
                        Following
                      </button>
                    )}
                  </li>
                ))}
                {optimisticFollowings.length === 0 && (
                  <li className="text-center text-gray-500">Not following anyone yet</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}