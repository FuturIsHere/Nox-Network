// components/NotificationButton.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import NotificationsList from './notifications/NotificationList'
import { useDropdown } from '@/contexts/DropdownContext'
import Image from "next/image";

// Interface pour typer les notifications
interface Notification {
  id: string;
  read: boolean;
  type: string;
  message?: string;
  createdAt: string;
  triggeredBy?: {
    id: string;
    username: string;
    name?: string;
    surname?: string;
    avatar?: string;
  };
  post?: {
    id: string;
    desc?: string;
    img?: string;
  };
  comment?: {
    id: string;
    desc: string;
  };
  formattedDate?: string;
}

const NotificationButton = () => {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const fetchingRef = useRef(false)

  // Hook pour la gestion des dropdowns exclusifs
  const { isDropdownOpen, setOpenDropdown } = useDropdown()
  const isOpen = isDropdownOpen('notifications')

  // Fonction pour récupérer le compteur de notifications non lues
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count')
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  // Fonction pour récupérer les notifications avec cache
  const fetchNotifications = async (force = false) => {
    // Éviter les appels multiples simultanés
    if (fetchingRef.current && !force) return
    
    try {
      fetchingRef.current = true
      
      // Ne montrer le loader que si on n'a jamais chargé ou si c'est un rechargement forcé
      if (!hasLoadedOnce || force) {
        setLoading(true)
      }
      
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        console.log('Notifications fetched:', data) // Debug
        setNotifications(data)
        setHasLoadedOnce(true)
        
        // Mettre à jour le compteur avec les données fraîches
        const unreadNotifications = data.filter((notif: Notification) => !notif.read)
        setUnreadCount(unreadNotifications.length)
      } else {
        console.error('Failed to fetch notifications:', response.status)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  // Fonction pour marquer toutes les notifications comme lues
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      })
      if (response.ok) {
        setUnreadCount(0)
        setNotifications(prev => prev.map((notif: Notification) => ({ ...notif, read: true })))
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error)
    }
  }

  // Actualiser le compteur au montage et périodiquement
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Pré-charger les notifications au premier montage pour éviter le délai
  useEffect(() => {
    fetchNotifications()
  }, [])

  const handleToggleDropdown = async () => {
    if (!isOpen) {
      // Ouverture : ouvrir le dropdown des notifications (ferme automatiquement les autres)
      setOpenDropdown('notifications')
      
      // Toujours recharger les notifications à l'ouverture pour avoir les données les plus récentes
      await fetchNotifications(true)
    } else {
      // Fermeture
      setOpenDropdown(null)
      if (unreadCount > 0) {
        markAllAsRead()
      }
    }
  }

  const handleCloseDropdown = () => {
    setOpenDropdown(null)
    if (unreadCount > 0) {
      markAllAsRead()
    }
  }

  // Fonction pour mettre à jour les notifications après suppression
  const handleNotificationUpdate = (updatedNotifications: Notification[]) => {
    setNotifications(updatedNotifications)
    const unreadNotifications = updatedNotifications.filter((notif: Notification) => !notif.read)
    setUnreadCount(unreadNotifications.length)
  }

  return (
    <>
      {/* Bouton de notification */}
      <button
        onClick={handleToggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
        disabled={loading && !isOpen && !hasLoadedOnce} // Désactiver seulement pendant le chargement initial
      >
        <Image src="/notifications.png" alt="" width={20} height={20} />
        {unreadCount > 0 && (
          <span className="absolute p-1 items-center -top-1 -right-1 bg-red-500 text-white text-xs min-w-[18px] h-[18px] rounded-[99px] flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown des notifications */}
      <NotificationsList 
        notifications={notifications} 
        isOpen={isOpen} 
        onClose={handleCloseDropdown}
        onNotificationUpdate={handleNotificationUpdate}
        loading={loading}
      />
    </>
  )
}

export default NotificationButton