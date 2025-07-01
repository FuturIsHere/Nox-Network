'use client'

import { useState, useTransition } from 'react'
import Image from "next/image"
import Link from "next/link"
import { removeFollower } from "@/lib/action"
import { useOptimistic } from 'react'

type User = {
  id: string
  username: string
  name?: string | null
  surname?: string | null
  avatar?: string | null
}

type Props = {
  followerCount: number
  username: string
  followers: User[]
  currentUserId?: string // ID de l'utilisateur connecté
}

export default function FollowersModal({ followerCount, username, followers, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [followersState, setFollowersState] = useState(followers)
  const [isPending, startTransition] = useTransition()

  const handleClose = () => setOpen(false)

  const handleRemoveFollower = async (followerId: string) => {
    startTransition(() => {
      removeOptimisticFollower(followerId)
    })
    
    try {
      await removeFollower(followerId)
      setFollowersState(prev => prev.filter(f => f.id !== followerId))
    } catch (err) {
      console.error('Erreur lors de la suppression du follower:', err)
      // Optionally revert the optimistic update on error
      setFollowersState(followers)
    }
  }

  const [optimisticFollowers, removeOptimisticFollower] = useOptimistic(
    followersState,
    (state, followerId: string) => state.filter(f => f.id !== followerId)
  )

  return (
    <div>
      <div
        className="flex flex-col items-center cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <span className="font-[600]">{optimisticFollowers.length}</span>
        <span className="text-sm">
          Follower{optimisticFollowers.length === 1 ? '' : 's'}
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[9.4px] flex items-center justify-center z-50"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-[30px] shadow-xl p-6 max-w-md w-full relative max-h-[400px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-2 right-3 text-gray-500"
            >
              <Image src="/reject.png" alt="" className="cursor-pointer" width={30} height={30} />
            </button>
            <h2 className="text-lg font-bold mb-6 text-center">Followers</h2>
            <div className="overflow-hidden max-h-[410px]">
              <ul className="space-y-4 max-h-64 overflow-y-auto">
                {optimisticFollowers.map((f) => (
                  <li key={f.id} className="flex text-left items-center justify-between space-x-3">
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
                        onClick={() => handleRemoveFollower(f.id)}
                        disabled={isPending}
                        className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
                {optimisticFollowers.length === 0 && (
                  <li className="text-center text-gray-500">No followers yet</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}