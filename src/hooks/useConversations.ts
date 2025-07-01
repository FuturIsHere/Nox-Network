// src/hooks/useConversations.ts

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

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

export const useConversations = (userId: string | undefined, initialConversations: Conversation[] = []) => {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [loading, setLoading] = useState(!initialConversations.length);
  
  const { onReceiveMessage, onUserStatusChange } = useSocket();

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Charger au montage si pas de conversations initiales
  useEffect(() => {
    if (!initialConversations.length) {
      loadConversations();
    } else {
      setConversations(initialConversations);
    }
  }, [initialConversations, loadConversations]);

  // Écouter les nouveaux messages pour mettre à jour les aperçus en temps réel
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onReceiveMessage((messageData: any) => {
      console.log('🔄 Mise à jour conversation en temps réel:', messageData);
      
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === messageData.conversationId) {
            return {
              ...conv,
              lastMessage: messageData.content || 'Nouveau message',
              lastMessageAt: messageData.createdAt || new Date().toISOString()
            };
          }
          return conv;
        }).sort((a, b) => {
          // Trier par date du dernier message (plus récent en premier)
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        });
      });
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [onReceiveMessage, userId]);

  // Écouter les changements de statut en ligne
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onUserStatusChange((data: any) => {
      console.log('👤 Mise à jour statut utilisateur:', data);
      
      setConversations(prev => 
        prev.map(conv => {
          if (conv.otherUser.id === data.userId) {
            return {
              ...conv,
              isOnline: data.isOnline
            };
          }
          return conv;
        })
      );
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [onUserStatusChange, userId]);

  // Fonction pour supprimer une conversation de la liste
  const removeConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
  }, []);

  // Fonction pour ajouter une nouvelle conversation
  const addConversation = useCallback((newConversation: Conversation) => {
    setConversations(prev => {
      // Vérifier si la conversation existe déjà
      const exists = prev.some(conv => conv.id === newConversation.id);
      if (exists) {
        return prev;
      }
      
      // Ajouter la nouvelle conversation en haut de la liste
      return [newConversation, ...prev];
    });
  }, []);

  return {
    conversations,
    loading,
    loadConversations,
    removeConversation,
    addConversation
  };
};