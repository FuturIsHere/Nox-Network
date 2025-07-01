// src/hooks/useGlobalUnreadMessages.ts

import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';

// Hook simple qui expose la fonction globale markConversationAsRead
export const useGlobalUnreadMessages = () => {
  const { markConversationAsRead, totalUnreadCount, unreadCounts } = useUnreadMessages();
  
  return {
    markConversationAsRead,
    totalUnreadCount,
    unreadCounts
  };
};