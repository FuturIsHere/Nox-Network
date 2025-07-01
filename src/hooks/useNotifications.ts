// hooks/useNotifications.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

type Notification = {
  id: string
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'FOLLOW_REQUEST' | 'MENTION'
  message: string
  read: boolean
  createdAt: string
  triggeredBy?: {
    id: string
    username: string
    avatar?: string | null
    name?: string | null
    surname?: string | null
  } | null
  post?: {
    id: number
    desc: string
    img?: string | null
  } | null
  comment?: {
    id: number
    desc: string
  } | null
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fonction pour récupérer toutes les notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/notifications')
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }
      
      const data = await response.json()
      setNotifications(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fonction pour récupérer le nombre de notifications non lues
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread-count')
      
      if (!response.ok) {
        throw new Error('Failed to fetch unread count')
      }
      
      const data = await response.json()
      setUnreadCount(data.count)
    } catch (err) {
      console.error('Error fetching unread count:', err)
    }
  }, [])

  // Fonction pour marquer une notification comme lue
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      })
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read')
      }
      
      // Mettre à jour l'état local
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      )
      
      // Réduire le compteur de notifications non lues
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [])

  // Fonction pour marquer toutes les notifications comme lues
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      })
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read')
      }
      
      // Mettre à jour l'état local
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      )
      
      // Réinitialiser le compteur
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }, [])

  // Fonction pour supprimer une notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete notification')
      }
      
      // Mettre à jour l'état local
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId))
      
      // Réduire le compteur si la notification n'était pas lue
      setUnreadCount(prev => {
        const deletedNotif = notifications.find(n => n.id === notificationId)
        return deletedNotif && !deletedNotif.read ? Math.max(0, prev - 1) : prev
      })
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }, [notifications])

  // Effet pour charger les données au montage du composant
  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [fetchNotifications, fetchUnreadCount])

  // Fonction pour rafraîchir les données
  const refresh = useCallback(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [fetchNotifications, fetchUnreadCount])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  }
}