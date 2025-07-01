// src/contexts/UnreadMessagesContext.tsx
'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';

interface UnreadCounts {
  [conversationId: string]: number;
}

interface ConversationPreview {
  [conversationId: string]: {
    lastMessage: string;
    lastMessageAt: string;
    senderName: string;
  };
}

interface UnreadMessagesContextType {
  unreadCounts: UnreadCounts;
  conversationPreviews: ConversationPreview;
  totalUnreadCount: number;
  loading: boolean;
  activeConversationId: string | null;
  setActiveConversationId: (conversationId: string | null) => void;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  refreshUnreadCounts: () => Promise<void>;
  updateUnreadCount: (conversationId: string, count: number) => void;
  incrementUnreadCount: (conversationId: string) => void;
  getFilteredUnreadCounts: () => UnreadCounts;
  getTotalUnreadCount: () => number;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined);

export const UnreadMessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const pathname = usePathname();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [conversationPreviews, setConversationPreviews] = useState<ConversationPreview>({});
  const [loading, setLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [countsLoaded, setCountsLoaded] = useState(false);
  const { onReceiveMessage, isConnected } = useSocket();

  // 🔥 NOUVEAU : Refs pour éviter les dépendances circulaires
  const activeConversationRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  // Détecter la conversation active basée sur l'URL - SIMPLIFIÉ
  useEffect(() => {
    const detectActiveConversation = () => {
      // Cas 1: URL directe /messages/[conversationId]
      const directMatch = pathname.match(/^\/messages\/([a-zA-Z0-9_-]+)$/);
      if (directMatch) {
        const conversationId = directMatch[1];
        console.log('🎯 [CONTEXT] Conversation active détectée via URL directe:', conversationId);
        setActiveConversationId(conversationId);
        return;
      }

      // Cas 2: Page /messages avec sélection via état local (sera géré par les composants)
      if (pathname === '/messages') {
        console.log('🎯 [CONTEXT] Sur la page messages, attente de sélection...');
        return;
      }

      // Cas 3: Autres pages - pas de conversation active
      console.log('🎯 [CONTEXT] Aucune conversation active détectée pour:', pathname);
      setActiveConversationId(null);
    };

    detectActiveConversation();
  }, [pathname]); // 🔥 RETIRÉ : countsLoaded et user?.id des dépendances

  // Fonctions pour obtenir les compteurs filtrés (excluant la conversation active)
  const getFilteredUnreadCounts = useCallback((): UnreadCounts => {
    if (!activeConversationId) {
      return unreadCounts;
    }

    const filtered = { ...unreadCounts };
    delete filtered[activeConversationId];
    
    console.log('🔍 [CONTEXT] Compteurs filtrés (sans conversation active):', {
      active: activeConversationId,
      original: unreadCounts,
      filtered: filtered
    });
    
    return filtered;
  }, [unreadCounts, activeConversationId]);

  const getTotalUnreadCount = useCallback((): number => {
    const filteredCounts = getFilteredUnreadCounts();
    const total = Object.values(filteredCounts).reduce((sum, count) => sum + count, 0);
    
    console.log('🔢 [CONTEXT] Total non lu calculé:', {
      activeConversation: activeConversationId,
      total: total,
      allCounts: unreadCounts,
      countsLoaded: countsLoaded
    });
    
    return total;
  }, [getFilteredUnreadCounts, activeConversationId, unreadCounts, countsLoaded]);

  // 🔥 NOUVEAU : Fonction pour marquer une conversation comme lue (sans dépendances problématiques)
  const markConversationAsReadInternal = useCallback(async (conversationId: string, updateState = true) => {
    if (!userIdRef.current) return;

    console.log('🎯 [CONTEXT] Marquage interne comme lu:', conversationId, 'updateState:', updateState);

    if (updateState) {
      setUnreadCounts(prev => {
        if (prev[conversationId] > 0) {
          console.log('📊 [CONTEXT] Réinitialisation compteur local:', conversationId);
          return { ...prev, [conversationId]: 0 };
        }
        return prev;
      });
    }

    // Appel API
    try {
      await fetch(`/api/messages/${conversationId}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ [CONTEXT] API marquage réussi:', conversationId);
    } catch (error) {
      console.error('❌ [CONTEXT] Erreur API marquage:', error);
    }
  }, []); // 🔥 AUCUNE dépendance pour éviter les cycles

  // Charger les compteurs initiaux - SANS dépendance sur activeConversationId
  const loadUnreadCounts = useCallback(async () => {
    if (!userIdRef.current) return;
    
    try {
      setLoading(true);
      console.log('🔄 [CONTEXT] Chargement des compteurs...');
      const response = await fetch('/api/messages/unread-counts');
      if (response.ok) {
        const counts = await response.json();
        console.log('📊 [CONTEXT] Compteurs reçus:', counts);
        
        // 🔥 NOUVEAU : Utiliser la ref pour éviter la dépendance
        const currentActiveId = activeConversationRef.current;
        if (currentActiveId && counts[currentActiveId] > 0) {
          console.log('🎯 [CONTEXT] Conversation active lors du chargement, marquage:', currentActiveId);
          counts[currentActiveId] = 0;
          
          // Marquer en base sans modifier l'état (déjà fait ci-dessus)
          markConversationAsReadInternal(currentActiveId, false);
        }
        
        setUnreadCounts(counts);
        setCountsLoaded(true);
      } else {
        console.error('❌ [CONTEXT] Erreur response:', response.status);
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Erreur lors du chargement des compteurs:', error);
    } finally {
      setLoading(false);
    }
  }, []); // 🔥 AUCUNE dépendance pour éviter les cycles

  // Charger au montage et quand l'utilisateur change
  useEffect(() => {
    if (user?.id) {
      console.log('👤 [CONTEXT] Utilisateur détecté, chargement des compteurs');
      loadUnreadCounts();
    }
  }, [user?.id, loadUnreadCounts]);

  // 🔥 NOUVEAU : Effect pour marquer comme lu quand la conversation active change (APRÈS le chargement initial)
  useEffect(() => {
    // Attendre que les compteurs soient chargés et qu'on ait un utilisateur
    if (!activeConversationId || !user?.id || !countsLoaded) return;

    console.log('🎯 [CONTEXT] Conversation active changée après chargement:', activeConversationId);
    
    // Vérifier si cette conversation a des messages non lus
    if (unreadCounts[activeConversationId] > 0) {
      console.log('📊 [CONTEXT] Marquage nécessaire pour:', activeConversationId);
      markConversationAsReadInternal(activeConversationId, true);
    } else {
      console.log('📊 [CONTEXT] Pas de marquage nécessaire, déjà à 0');
    }
  }, [activeConversationId, countsLoaded, user?.id]); // 🔥 PAS unreadCounts dans les dépendances

  // Polling pour synchronisation
  useEffect(() => {
    if (!user?.id || !countsLoaded) return;

    const interval = setInterval(() => {
      console.log('🔄 [CONTEXT] Synchronisation automatique des compteurs');
      loadUnreadCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id, countsLoaded, loadUnreadCounts]);

  // Écouter les nouveaux messages via Socket.IO
  useEffect(() => {
    if (!user?.id || !isConnected) return;

    console.log('🔌 [CONTEXT] Configuration de l\'écoute des messages');

    const unsubscribe = onReceiveMessage((messageData: any) => {
      console.log('📩 [CONTEXT] Message reçu:', {
        id: messageData.id,
        senderId: messageData.senderId,
        conversationId: messageData.conversationId,
        currentUserId: user.id,
        activeConversationId: activeConversationRef.current // 🔥 Utiliser la ref
      });
      
      // Ne pas incrémenter si c'est l'utilisateur actuel qui a envoyé le message
      if (messageData.senderId === user.id) {
        console.log('⏭️ [CONTEXT] Message envoyé par l\'utilisateur actuel, ignoré');
        return;
      }

      // Ne pas incrémenter si le message est pour la conversation actuellement active
      if (messageData.conversationId === activeConversationRef.current) {
        console.log('👁️ [CONTEXT] Message reçu pour conversation active, auto-marquage comme lu');
        markConversationAsReadInternal(messageData.conversationId, false);
        return;
      }

      // Incrémenter le compteur pour les autres conversations
      console.log('📈 [CONTEXT] Incrémentation du compteur pour conversation:', messageData.conversationId);
      
      setUnreadCounts(prev => {
        const newCounts = {
          ...prev,
          [messageData.conversationId]: (prev[messageData.conversationId] || 0) + 1
        };
        console.log('📊 [CONTEXT] Nouveaux compteurs après réception:', newCounts);
        return newCounts;
      });

      // Mettre à jour l'aperçu de la conversation
      setConversationPreviews(prev => ({
        ...prev,
        [messageData.conversationId]: {
          lastMessage: messageData.content || 'Nouveau message',
          lastMessageAt: messageData.createdAt || new Date().toISOString(),
          senderName: messageData.senderName || 'Utilisateur'
        }
      }));
    });

    return () => {
      console.log('🧹 [CONTEXT] Nettoyage de l\'écoute des messages');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [onReceiveMessage, user?.id, isConnected, markConversationAsReadInternal]);

  // Marquer une conversation comme lue - fonction publique
  const markConversationAsRead = useCallback(async (conversationId: string) => {
    console.log('🔄 [CONTEXT] Marquage public comme lu pour conversation:', conversationId);
    
    try {
      // Mettre à jour l'état local IMMÉDIATEMENT
      setUnreadCounts(prev => {
        const newCounts = {
          ...prev,
          [conversationId]: 0
        };
        console.log('📊 [CONTEXT] Nouveaux compteurs après marquage public:', newCounts);
        return newCounts;
      });

      // Puis faire l'appel API
      const response = await fetch(`/api/messages/${conversationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('❌ [CONTEXT] Erreur API lors du marquage public comme lu');
        await loadUnreadCounts();
      } else {
        console.log('✅ [CONTEXT] Conversation marquée comme lue avec succès (public)');
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Erreur lors du marquage public comme lu:', error);
      await loadUnreadCounts();
    }
  }, [loadUnreadCounts]);

  // Calculer le total des messages non lus (filtré)
  const totalUnreadCount = getTotalUnreadCount();

  // Fonction pour forcer la mise à jour d'un compteur spécifique
  const updateUnreadCount = useCallback((conversationId: string, count: number) => {
    console.log('🔄 [CONTEXT] Mise à jour forcée du compteur:', conversationId, '=', count);
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: count
    }));
  }, []);

  // Fonction pour incrémenter le compteur d'une conversation
  const incrementUnreadCount = useCallback((conversationId: string) => {
    console.log('📈 [CONTEXT] Incrémentation manuelle pour:', conversationId);
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || 0) + 1
    }));
  }, []);

  const value: UnreadMessagesContextType = {
    unreadCounts,
    conversationPreviews,
    totalUnreadCount,
    loading,
    activeConversationId,
    setActiveConversationId,
    markConversationAsRead,
    refreshUnreadCounts: loadUnreadCounts,
    updateUnreadCount,
    incrementUnreadCount,
    getFilteredUnreadCounts,
    getTotalUnreadCount
  };

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};

export const useUnreadMessages = () => {
  const context = useContext(UnreadMessagesContext);
  if (context === undefined) {
    throw new Error('useUnreadMessages must be used within an UnreadMessagesProvider');
  }
  return context;
};