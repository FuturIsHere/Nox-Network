"use client"

import { switchFollow } from "@/lib/action"
import { useOptimistic, useState, useTransition } from "react"

interface SuggestionFollowButtonProps {
  userId: string
}

const SuggestionFollowButton = ({ userId }: SuggestionFollowButtonProps) => {
  const [followState, setFollowState] = useState({
    following: false,
    requestSent: false,
    isLoading: false
  })

  const [isPending, startTransition] = useTransition()

  const [optimisticState, switchOptimisticState] = useOptimistic(
    followState,
    (state, action: "follow" | "unfollow") => {
      if (action === "follow") {
        return {
          ...state,
          requestSent: true,
          isLoading: false
        }
      } else if (action === "unfollow") {
        return {
          ...state,
          requestSent: false,
          following: false,
          isLoading: false
        }
      }
      return state
    }
  )

  const handleFollow = async () => {
    if (optimisticState.following || isPending) return
    
    startTransition(async () => {
      switchOptimisticState("follow")
      
      try {
        await switchFollow(userId)
        setFollowState({
          following: false,
          requestSent: true,
          isLoading: false
        })
      } catch (error) {
        console.error("Error following user:", error)
        setFollowState({
          following: false,
          requestSent: false,
          isLoading: false
        })
      }
    })
  }

  const handleUnfollow = async () => {
    if (!optimisticState.requestSent || isPending) return
    
    startTransition(async () => {
      switchOptimisticState("unfollow")
      
      try {
        // Appeler la même action pour annuler la demande
        await switchFollow(userId)
        setFollowState({
          following: false,
          requestSent: false,
          isLoading: false
        })
      } catch (error) {
        console.error("Error unfollowing user:", error)
        // Revenir à l'état précédent en cas d'erreur
        setFollowState({
          following: false,
          requestSent: true,
          isLoading: false
        })
      }
    })
  }

  const handleClick = () => {
    if (optimisticState.requestSent) {
      handleUnfollow()
    } else {
      handleFollow()
    }
  }

  const getButtonText = () => {
    if (isPending || optimisticState.isLoading) return "..."
    if (optimisticState.following) return "Following"
    if (optimisticState.requestSent) return "Sent"
    return "Follow"
  }

  const getButtonClass = () => {
    const baseClass = "text-white text-xs py-2 px-3 rounded-[99px] transition-colors duration-200 min-w-[70px]"
    
    if (optimisticState.following) {
      return `${baseClass} bg-gray-500`
    }
    if (optimisticState.requestSent) {
      return `${baseClass} bg-green-500 hover:bg-green-600`
    }
    if (isPending || optimisticState.isLoading) {
      return `${baseClass} bg-blue-400 cursor-not-allowed`
    }
    return `${baseClass} bg-blue-500 hover:bg-blue-600`
  }

  return (
    <button
      onClick={handleClick}
      disabled={optimisticState.following || isPending}
      className={getButtonClass()}
      title={optimisticState.requestSent ? "Cliquez pour annuler la demande" : "Suivre cet utilisateur"}
    >
      {getButtonText()}
    </button>
  )
}

export default SuggestionFollowButton