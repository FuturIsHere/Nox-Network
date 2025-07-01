'use client'

import Image from "next/image"
import { useAuth } from "@clerk/nextjs"
import { useOptimistic, useState, useEffect } from "react"
import { switchLike } from "@/lib/action"
import LikesModal from "../LikesModal"

type User = {
  id: string
  username: string
  name?: string | null
  surname?: string | null
  avatar?: string | null
}

const PostInteraction = ({ 
  postId, 
  likes, 
  commentNumber,
  initialLikedUsers = []
}: { 
  postId: number, 
  likes: string[], 
  commentNumber: number,
  initialLikedUsers?: User[]
}) => {
    const { isLoaded, userId } = useAuth()
    const [likedUsers, setLikedUsers] = useState<User[]>(initialLikedUsers)

    const [likeState, setLikeState] = useState({
        likeCount: likes.length,
        isLiked: userId ? likes.includes(userId) : false,
    });

    const [optimisticLike, switchOptimisticLike] = useOptimistic(likeState, (state, value) => {
        return {
            likeCount: state.isLiked ? state.likeCount - 1 : state.likeCount + 1,
            isLiked: !state.isLiked,
        }
    })

    // Load liked users when component mounts
    useEffect(() => {
        fetchLikedUsers()
    }, [postId])

    // Function to fetch users who liked the post
    async function fetchLikedUsers() {
      try {
        console.log("Fetching liked users for post ID:", postId);
        const response = await fetch(`/api/posts/${postId}/likes`)
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error:", response.status, errorText);
          return;
        }
        
        const data = await response.json()
        console.log("Fetched liked users:", data);
        setLikedUsers(data)
      } catch (error) {
        console.error("Error fetching liked users:", error)
      }
    }

    const likeAction = async () => {
        switchOptimisticLike("")
        try {
            await switchLike(postId)
            setLikeState(state => ({
                likeCount: state.isLiked ? state.likeCount - 1 : state.likeCount + 1,
                isLiked: !state.isLiked,
            }))
            // Reload liked users after a like/unlike action
            setTimeout(fetchLikedUsers, 500) // Add a small delay to ensure the DB has updated
        } catch (err) {
            console.error("Error in like action:", err)
        }
    }
    
    return (
        <div className="flex items-center justify-between text-sm my-4">
            <div className="flex gap-8">
                <div className="flex items-center gap-2">
                    <form action={likeAction}>
                        <button>
                            <Image width={25} height={25} src={optimisticLike.isLiked ? "/liked.png" : "/like.png"} alt="" className="cursor-pointor" />
                        </button>
                    </form>
                    {optimisticLike.likeCount > 0 ? (
                        <LikesModal likeCount={optimisticLike.likeCount} likedUsers={likedUsers} />
                    ) : (
                        <span className="text-gray-500 font-[400]">
                            {optimisticLike.likeCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2" >
                    <Image width={25} height={25} src="/comment.png" alt="" className="cursor-pointor w-auto h-6" />
                    <span className="text-gray-500 font-[400]">
                        {commentNumber}
                    </span>
                </div>
            </div>
            <div>
                <div className="flex items-center gap-2" >
                    <span className="text-gray-500">

                    </span>
                </div>
            </div>
        </div>
    )
}

export default PostInteraction