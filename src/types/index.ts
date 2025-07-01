// Fichier principal d'exportation des types
export * from './socket';

// Types globaux pour l'application
export interface BaseUser {
  id: string;
  username: string;
  name?: string | null;
  surname?: string | null;
  avatar?: string | null;
}

export interface BaseMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO';
  mediaUrl?: string | null;
}

export interface BaseConversation {
  id: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  otherUser: BaseUser;
  isOnline: boolean;
}

// Types pour les props des composants
export interface ConversationViewProps {
  conversation: BaseConversation;
  initialMessages: BaseMessage[];
  allConversations: BaseConversation[];
}

export interface MessagingSystemProps {
  initialConversations?: BaseConversation[];
}