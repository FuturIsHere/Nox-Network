'use client'

import { useState } from 'react'
import Image from "next/image"
import Link from "next/link"

type User = {
  id: string
  username: string
  name?: string | null
  surname?: string | null
  avatar?: string | null
}

type Props = {
  likeCount: number
  commentId: number
}

export default function CommentLikesModal({ likeCount, commentId }: Props) {
  const [open, setOpen] = useState(false)
  const [likedUsers, setLikedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpenModal = async () => {
    setOpen(true)
    await fetchLikedUsers()
  }

  const handleCloseModal = () => {
    setOpen(false)
  }

  async function fetchLikedUsers() {
    if (likeCount === 0) return

    setLoading(true)
    try {
      const response = await fetch(`/api/comments/${commentId}/likes`)
      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error:", response.status, errorText)
        return
      }

      const data = await response.json()
      setLikedUsers(data)
    } catch (error) {
      console.error("Error fetching comment liked users:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {likeCount > 0 ? (
        <span
          className="text-gray-500 font-[400] cursor-pointer text-xs"
          onClick={handleOpenModal}
        >
          {likeCount}
        </span>
      ) : (
        <span className="text-gray-500 font-[400] text-xs">
          {likeCount}
        </span>
      )}

      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[9.4px] flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-[30px] shadow-xl p-6 max-w-md w-full relative max-h-[400px]"
            onClick={(e) => e.stopPropagation()} // ← empêche la propagation du clic à l'arrière-plan
          >
            <button
              onClick={handleCloseModal}
              className="absolute top-2 right-3 text-gray-500"
            >
              <Image src="/reject.png" alt="" className="cursor-pointer" width={30} height={30} />
            </button>
            <h2 className="text-lg font-bold mb-6 text-center text-black">
              Likes
            </h2>
            <div className="overflow-hidden max-h-[410px]">
              <ul className="space-y-4 max-h-64 overflow-y-auto">
                {loading ? (
                  <li className="text-center text-gray-500">Loading...</li>
                ) : likedUsers && likedUsers.length > 0 ? (
                  likedUsers.map((user) => (
                    <li key={user.id} className="flex text-left items-center space-x-3">
                      <Link href={`/profile/${user.username}`}>
                        <img
                          src={user.avatar || '/noAvatar.png'}
                          alt={user.username}
                          className="w-10 h-10 rounded-full"
                        />
                      </Link>
                      <Link href={`/profile/${user.username}`}>
                        <div className='flex flex-col'>
                          <span className='font-[600] text-black'>{user.username}</span>
                          <span className='text-[#737373] font-[500]'>
                            {(user.name && user.surname) ? `${user.name} ${user.surname}` : user.username}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="text-center text-gray-500">No likes yet</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}