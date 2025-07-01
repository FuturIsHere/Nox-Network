// Types pour les événements Socket.IO

export interface SocketMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO';
  mediaUrl?: string | null;
  conversationId: string;
}

export interface TypingData {
  userId: string;
  username: string;
  conversationId: string;
}

export interface StopTypingData {
  userId: string;
  username?: string;
}

export interface UserStatusData {
  userId: string;
  isOnline: boolean;
}

export interface MessagesReadData {
  userId: string;
  conversationId: string;
}

export interface JoinRoomData {
  conversationId: string;
  userId: string;
}

export interface SocketUser {
  id: string;
  username: string;
  name?: string | null;
  surname?: string | null;
  avatar?: string | null;
}

// Types pour les callbacks Socket.IO
export type MessageCallback = (messageData: SocketMessage) => void;
export type TypingCallback = (data: TypingData) => void;
export type StopTypingCallback = (data: StopTypingData) => void;
export type UserStatusCallback = (data: UserStatusData) => void;
export type MessagesReadCallback = (data: MessagesReadData) => void;