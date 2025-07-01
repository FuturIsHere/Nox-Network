// components/notifications/NotificationsList.tsx
'use client'

import { formatPostDate } from '@/utils/formatPostDate'
import Link from 'next/link'
import Image from 'next/image'
import { Bell, Heart, MessageCircle, UserPlus, Users, X, Play, AtSign, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

interface NotificationsListProps {
  notifications: any[]
  isOpen?: boolean
  onClose?: () => void
  onNotificationUpdate?: (notifications: any[]) => void
  loading?: boolean
}

const NotificationsList = ({ 
  notifications: initialNotifications, 
  isOpen = true, 
  onClose, 
  onNotificationUpdate,
  loading = false 
}: NotificationsListProps) => {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mettre à jour les notifications quand les props changent
  useEffect(() => {
    console.log('Notifications updated:', initialNotifications) // Debug
    setNotifications(initialNotifications)
  }, [initialNotifications])

  // Pour la page complète, ne pas limiter les notifications
  const isDropdown = onClose !== undefined
  const displayedNotifications = isDropdown ? notifications.slice(0, 5) : notifications
  const hasMoreNotifications = isDropdown && notifications.length > 5

  // Fonction pour vérifier si le média est une vidéo
  const isVideo = (url: string) => {
    if (!url) return false;
    
    // Vérifications pour les extensions de fichiers vidéo
    const videoExtensions = /\.(mp4|webm|ogg|mov|avi|wmv|flv|m4v|3gp|mkv)(\?.*)?$/i;
    if (videoExtensions.test(url)) {
      return true;
    }
    
    // Vérifications pour les chemins contenant 'videos'
    if (url.includes('/videos/')) {
      return true;
    }
    
    return false;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LIKE':
        return <Heart className="w-5 h-5 text-red-500" />
      case 'COMMENT':
        return <MessageCircle className="w-5 h-5 text-blue-500" />
      case 'FOLLOW':
        return <UserPlus className="w-5 h-5 text-green-500" />
      case 'FOLLOW_REQUEST':
        return <Users className="w-5 h-5 text-orange-500" />
      case 'MENTION':
        return <AtSign className="w-5 h-5 text-purple-500" />
      default:
        return <Bell className="w-5 h-5 text-gray-500" />
    }
  }

  const getNotificationLink = (notif: any) => {
    // Si c'est une notification liée à un post (like, comment ou mention)
    if (notif.post && (notif.type === 'LIKE' || notif.type === 'COMMENT' || notif.type === 'MENTION')) {
      return `/post/${notif.post.id}`
    }
    // Si c'est une notification de suivi, aller vers le profil
    if (notif.triggeredBy && (notif.type === 'FOLLOW' || notif.type === 'FOLLOW_REQUEST')) {
      return `/profile/${notif.triggeredBy.username}`
    }
    // Fallback vers le profil de la personne qui a déclenché la notification
    if (notif.triggeredBy) {
      return `/profile/${notif.triggeredBy.username}`
    }
    return '#'
  }

  const getNotificationText = (notif: any) => {
    const userName = notif.triggeredBy 
      ? (notif.triggeredBy.name && notif.triggeredBy.surname 
          ? `${notif.triggeredBy.name} ${notif.triggeredBy.surname}`
          : notif.triggeredBy.username)
      : 'Quelqu\'un'

    switch (notif.type) {
      case 'LIKE':
        return `${userName} a aimé votre publication`
      case 'COMMENT':
        return `${userName} a commenté votre publication`
      case 'FOLLOW':
        return `${userName} a accepté votre demande de suivi`
      case 'FOLLOW_REQUEST':
        return `${userName} souhaite vous suivre`
      case 'MENTION':
        return `${userName} vous a mentionné${notif.comment ? ' dans un commentaire' : ' dans une publication'}`
      default:
        return notif.message || 'Nouvelle notification'
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    // Supprimer optimistiquement de l'état local
    const updatedNotifications = notifications.filter(notif => notif.id !== notificationId)
    setNotifications(updatedNotifications)
    
    // Informer le parent si nécessaire
    if (onNotificationUpdate) {
      onNotificationUpdate(updatedNotifications)
    }
    
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        // Si la suppression échoue, restaurer la notification
        setNotifications(initialNotifications)
        console.error('Erreur lors de la suppression de la notification')
      }
    } catch (error) {
      // Si la suppression échoue, restaurer la notification
      setNotifications(initialNotifications)
      console.error('Erreur lors de la suppression:', error)
    }
  }

  if (!mounted || !isOpen) return null

  // Si pas de onClose (utilisation dans une page complète), rendre directement sans portal
  if (!onClose) {
    return (
      <div className="">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
      
        </div>

        {/* Liste des notifications */}
        <div className="max-h-screen overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-2" />
              <p className="text-gray-500">Chargement des notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Aucune notification</p>
            </div>
          ) : (
            <>
              {displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notif.read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar de l'utilisateur qui a déclenché la notification */}
                    <div className="flex-shrink-0 relative">
                      {notif.triggeredBy?.avatar ? (
                        <Image
                          src={notif.triggeredBy.avatar}
                          alt={notif.triggeredBy.username}
                          width={70}
                          height={70}
                          className="rounded-full w-12 h-12 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium">
                            {notif.triggeredBy?.username?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      {/* Point bleu pour les notifications non lues */}
                      {!notif.read && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>

                    {/* Contenu de la notification */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={getNotificationLink(notif)}
                        className="block hover:text-blue-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium break-words ${!notif.read ? 'text-gray-900 font-semibold' : 'text-gray-900'}`}>
                              {getNotificationText(notif)}
                            </p>
                            
                            {/* Aperçu du post si disponible */}
                            {notif.post && (
                              <div className="mt-2 flex items-center gap-2">
                                {/* Aperçu du texte du post */}
                                {notif.post.desc && (
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-600 line-clamp-2 break-words">
                                      "{notif.post.desc}"
                                    </p>
                                  </div>
                                )}
                                
                                {/* Aperçu du média (image ou vidéo) */}
                                {notif.post.img && (
                                  <div className="relative w-12 h-12 flex-shrink-0">
                                    {isVideo(notif.post.img) ? (
                                      <div className="relative w-full h-full">
                                        <video
                                          src={notif.post.img}
                                          className="w-full h-full object-cover rounded-lg"
                                          muted
                                          preload="metadata"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                                          <Play className="w-4 h-4 text-white" />
                                        </div>
                                      </div>
                                    ) : (
                                      <Image
                                        src={notif.post.img}
                                        alt="Post media"
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover rounded-lg"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Aperçu du commentaire si disponible */}
                            {notif.comment && (
                              <div className="mt-1 min-w-0">
                                <p className="text-xs text-gray-600 line-clamp-2 break-words">
                                  Commentaire: "{notif.comment.desc}"
                                </p>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-500">
                                {notif.formattedDate || formatPostDate(new Date(notif.createdAt))}
                              </p>
                       
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            {/* Icône du type de notification */}
                            {getNotificationIcon(notif.type)}
                            
                            {/* Indicateur non lu */}
                            {!notif.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>

                    {/* Bouton de suppression */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteNotification(notif.id)
                      }}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Supprimer la notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div 
        className="bg-black/65 backdrop-blur-[9.4px] rounded-[30px] overflow-hidden shadow-md min-w-[400px] max-w-[500px] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-500">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Notifications</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Liste des notifications */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-300 mb-2" />
              <p className="text-gray-400">Chargement des notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-2 text-white/50" />
              <p>Aucune notification</p>
            </div>
          ) : (
            <>
              {displayedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-white/10 transition-colors ${
                    !notif.read ? 'bg-blue-500/30 border-l-4 border-blue-400' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar de l'utilisateur qui a déclenché la notification */}
                    <div className="flex-shrink-0 relative">
                      {notif.triggeredBy?.avatar ? (
                        <Image
                          src={notif.triggeredBy.avatar}
                          alt={notif.triggeredBy.username}
                          width={70}
                          height={70}
                          className="rounded-full w-12 h-12 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {notif.triggeredBy?.username?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      {/* Point bleu pour les notifications non lues dans le dropdown */}
                      {!notif.read && (
                        <div className="absolute -top-0 -right-1 w-3 h-3 bg-blue-400 rounded-full ring-2 ring-black/50 z-30 "></div>
                      )}
                    </div>

                    {/* Contenu de la notification */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={getNotificationLink(notif)}
                        className="block hover:text-blue-400"
                        onClick={onClose}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium break-words ${!notif.read ? 'text-white font-semibold' : 'text-white'}`}>
                              {getNotificationText(notif)}
                            </p>
                            
                            {/* Aperçu du post si disponible */}
                            {notif.post && (
                              <div className="mt-2 flex items-center gap-2">
                                {/* Aperçu du texte du post */}
                                {notif.post.desc && (
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-300 line-clamp-2 break-words">
                                      "{notif.post.desc}"
                                    </p>
                                  </div>
                                )}
                                
                                {/* Aperçu du média (image ou vidéo) */}
                                {notif.post.img && (
                                  <div className="relative w-12 h-12 flex-shrink-0">
                                    {isVideo(notif.post.img) ? (
                                      <div className="relative w-full h-full">
                                        <video
                                          src={notif.post.img}
                                          className="w-full h-full object-cover rounded-lg"
                                          muted
                                          preload="metadata"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                                          <Play className="w-4 h-4 text-white" />
                                        </div>
                                      </div>
                                    ) : (
                                      <Image
                                        src={notif.post.img}
                                        alt="Post media"
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover rounded-lg"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Aperçu du commentaire si disponible */}
                            {notif.comment && (
                              <div className="mt-1 min-w-0">
                                <p className="text-xs text-gray-300 line-clamp-2 break-words">
                                  Commentaire: "{notif.comment.desc}"
                                </p>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-400">
                                {notif.formattedDate || formatPostDate(new Date(notif.createdAt))}
                              </p>
                           
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            {/* Icône du type de notification */}
                            {getNotificationIcon(notif.type)}
                            
                            {/* Indicateur non lu - petit point à côté de l'icône */}
                            {!notif.read && (
                              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>

                    {/* Bouton de suppression */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteNotification(notif.id)
                      }}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Supprimer la notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Lien "Voir toutes les notifications" */}
              {hasMoreNotifications && (
                <div className="p-4 border-t border-gray-500 bg-black/20">
                  <Link
                    href="/notifications"
                    className="block text-center text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors"
                    onClick={onClose}
                  >
                    Voir toutes les notifications ({notifications.length})
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default NotificationsList