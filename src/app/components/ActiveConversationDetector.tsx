'use client'

import { useEffect } from 'react';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';

interface ActiveConversationDetectorProps {
  conversationId: string;
}

const ActiveConversationDetector: React.FC<ActiveConversationDetectorProps> = ({ 
  conversationId 
}) => {
  const { markConversationAsRead } = useUnreadMessages();

  useEffect(() => {
    // Marquer comme lu quand la page devient visible
    const handleVisibilityChange = () => {
      if (!document.hidden && document.hasFocus()) {
        console.log('🎯 [ActiveDetector] Page visible, marquage auto comme lu:', conversationId);
        markConversationAsRead(conversationId);
      }
    };

    // Marquer comme lu quand la fenêtre gagne le focus
    const handleFocus = () => {
      console.log('🎯 [ActiveDetector] Focus gagné, marquage auto comme lu:', conversationId);
      markConversationAsRead(conversationId);
    };

    // Écouter les événements
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Marquer comme lu immédiatement si la page est déjà visible et en focus
    if (!document.hidden && document.hasFocus()) {
      console.log('🎯 [ActiveDetector] Page déjà visible au montage, marquage comme lu:', conversationId);
      markConversationAsRead(conversationId);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [conversationId, markConversationAsRead]);

  // Ce composant ne rend rien, il sert juste à détecter l'activité
  return null;
};

export { ActiveConversationDetector };