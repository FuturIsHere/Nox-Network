// components/MessageButton.tsx
'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Image from "next/image"
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import { useDropdown } from '@/contexts/DropdownContext'
import { UnreadBadge } from './messaging/UnreadBadge'

// Interface pour typer les conversations
interface User {
  id: string;
  username: string;
  name?: string;
  surname?: string;
  avatar?: string;
}

interface Conversation {
  id: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  otherUser: User;
  isOnline: boolean;
}

const MessageButton = () => {
  const router = useRouter()
  const { user } = useUser()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Hook pour la gestion des dropdowns exclusifs
  const { isDropdownOpen, setOpenDropdown } = useDropdown()
  const isOpen = isDropdownOpen('messages')

  // 🔥 ULTRA SIMPLE : Même logique exacte que MessageIconWithBadge
  const { 
    unreadCounts,
    activeConversationId,
    markConversationAsRead
  } = useUnreadMessages()

  // 🔥 MÊME CALCUL que MessageIconWithBadge
  const totalUnreadCount = useMemo(() => {
    if (!activeConversationId) return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    
    const filteredCounts = { ...unreadCounts };
    delete filteredCounts[activeConversationId];
    return Object.values(filteredCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts, activeConversationId]);

  // 🔥 MÊME CALCUL pour filtrer les compteurs
  const filteredUnreadCounts = useMemo(() => {
    if (!activeConversationId) return unreadCounts;
    
    const filtered = { ...unreadCounts };
    delete filtered[activeConversationId];
    return filtered;
  }, [unreadCounts, activeConversationId]);

  useEffect(() => {
    setMounted(true)
  }, [])

  // 🔥 SUPPRIMÉ : Tous les délais et timers problématiques
  // 🔥 SUPPRIMÉ : Tous les useEffect de route watching
  // 🔥 SUPPRIMÉ : Tous les refreshUnreadCounts complexes

  // Fonction simple pour charger les conversations
  const loadConversations = async () => {
    if (!user?.id || loading) return
    
    try {
      setLoading(true)
      const response = await fetch('/api/messages')
      if (response.ok) {
        const data = await response.json()
        setConversations(data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🔥 SIMPLE : Charger quand on ouvre le dropdown, c'est tout
  const handleToggleDropdown = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    if (!isOpen) {
      setOpenDropdown('messages')
      await loadConversations() // Simple et direct
    } else {
      setOpenDropdown(null)
    }
  }

  const handleClose = () => {
    setOpenDropdown(null)
  }

  const handleConversationClick = async (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    // Simple : marquer comme lu et naviguer
    await markConversationAsRead(conversationId)
    setOpenDropdown(null)
    router.push(`/messages/${conversationId}`)
  }

  const handleViewAllMessages = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setOpenDropdown(null)
    router.push('/messages')
  }

  const getUserDisplayName = (user: User) => {
    return (user.name && user.surname) ? `${user.name} ${user.surname}` : user.username
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'À l\'instant'
    if (diffInMinutes < 60) return `${diffInMinutes} min`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} h`
    return `${Math.floor(diffInMinutes / 1440)} j`
  }

  // 🔥 SIMPLE : Tri direct sans complexité
  const sortedConversations = useMemo(() => {
    return [...conversations]
      .sort((a, b) => {
        const aUnread = filteredUnreadCounts[a.id] || 0
        const bUnread = filteredUnreadCounts[b.id] || 0
        
        if (aUnread !== bUnread) {
          return bUnread - aUnread
        }
        
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      })
      .slice(0, 5)
  }, [conversations, filteredUnreadCounts]);

  return (
    <>
      {/* 🔥 MÊME LOGIQUE que MessageIconWithBadge pour la pastille */}
      <button
        ref={buttonRef}
        onClick={handleToggleDropdown}
        className="relative p-2 text-gray-300 hover:text-gray-800 transition-colors duration-200"
        type="button"
        data-message-button="true"
      >
        <Image src="/messages.png" alt="Messages" width={20} height={20} />
        {totalUnreadCount > 0 && (
          <span className="absolute p-1 items-center -top-1 -right-1 bg-red-500 text-white text-xs min-w-[18px] h-[18px] rounded-[99px] flex items-center justify-center">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </button>

      {/* Dropdown simple */}
      {mounted && isOpen && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-20"
          onClick={handleClose}
        >
          <div 
            className="bg-black/65 backdrop-blur-[9.4px] rounded-[30px] overflow-hidden shadow-md min-w-[400px] max-w-[500px] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-500">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Messages</h3>
                <button
                  onClick={handleViewAllMessages}
                  className="text-sm text-gray-400 hover:text-blue-400 font-medium transition-colors"
                  type="button"
                >
                  Voir tout
                </button>
              </div>
              {totalUnreadCount > 0 && (
                <p className="text-sm text-gray-300 mt-1">
                  {totalUnreadCount} message{totalUnreadCount > 1 ? 's' : ''} non lu{totalUnreadCount > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Liste des conversations */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-transparent"></div>
                  <span className="ml-2 text-sm text-gray-300">Chargement...</span>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <Image src="/messages.png" alt="" width={40} height={40} className="mx-auto mb-2 opacity-50" />
                  <p className="text-gray-400 text-sm">Aucune conversation</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setOpenDropdown(null)
                      router.push('/messages/new')
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2 transition-colors"
                    type="button"
                  >
                    Commencer une conversation
                  </button>
                </div>
              ) : (
                sortedConversations.map((conversation) => {
                  // 🔥 MÊME LOGIQUE directe que MessageIconWithBadge
                  const unreadCount = filteredUnreadCounts[conversation.id] || 0
                  
                  return (
                    <div
                      key={conversation.id}
                      onClick={(e) => handleConversationClick(conversation.id, e)}
                      className="flex items-center p-3 hover:bg-white/10 cursor-pointer last:border-b-0 transition-colors duration-150"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={conversation.otherUser.avatar || '/noAvatar.png'}
                          alt={getUserDisplayName(conversation.otherUser)}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        {conversation.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
                        )}
                      </div>

                      <div className="ml-3 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-white truncate text-sm">
                            {getUserDisplayName(conversation.otherUser)}
                          </h4>
                          <span className="text-xs text-gray-300 flex-shrink-0 ml-2">
                            {formatTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-300 truncate flex-1 mr-2">
                            {conversation.lastMessage || 'Nouvelle conversation'}
                          </p>
                          {unreadCount > 0 && (
                            <UnreadBadge count={unreadCount} size="sm" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {conversations.length > 0 && !loading && (
              <div className="p-3 border-t border-gray-500 bg-black/20">
                <button
                  onClick={handleViewAllMessages}
                  className="w-full text-center text-sm text-blue-400 hover:text-blue-300 font-medium py-1 transition-colors duration-150"
                  type="button"
                >
                  Voir toutes les conversations
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default MessageButton