// components/leftMenu/MessageIconWithBadge.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import Image from "next/image"
import Link from "next/link"
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import { useMemo } from 'react'

const MessageIconWithBadge = () => {
  const { user } = useUser()
  
  // 🔥 CORRECTION : Utiliser directement les valeurs du contexte
  const { unreadCounts, activeConversationId } = useUnreadMessages()
  
  // 🔥 NOUVEAU : Calculer avec useMemo pour éviter les recalculs
  const totalUnreadCount = useMemo(() => {
    if (!activeConversationId) return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    
    const filteredCounts = { ...unreadCounts };
    delete filteredCounts[activeConversationId];
    return Object.values(filteredCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts, activeConversationId]);

  return (
    <Link href="/messages" className="flex flex-col items-center gap-2 p-3 group h-20">
      <div className="relative transition-transform duration-200 group-hover:scale-110 w-12 h-12">
        <Image 
          src="/message.png" 
          alt="Messages" 
          width={120} 
          height={120} 
          className="w-full h-full object-contain" 
        />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-[20px] h-[20px] rounded-full flex items-center justify-center font-medium shadow-sm">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </div>
      <span className="text-xs text-center mt-auto">Messages</span>
    </Link>
  )
}

export { MessageIconWithBadge }