import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO';
  mediaUrl?: string | null;
  conversationId: string;
  timestamp?: string;
}

interface TypingData {
  userId: string;
  username: string;
  conversationId: string;
}

interface StopTypingData {
  userId: string;
  username?: string;
  conversationId?: string;
}

interface UserStatusData {
  userId: string;
  isOnline: boolean;
}

interface ExtendedSocket extends Socket {
  handlers?: {
    handleReceiveMessage: (data: SocketMessage) => void;
    handleUserTyping: (data: TypingData) => void;
    handleUserStopTyping: (data: StopTypingData) => void;
    handleUserStatusChange: (data: UserStatusData) => void;
    handleMessageSent: (data: any) => void;
  };
}

export const useSocket = () => {
  const SOCKET_ENABLED = true;
  
  const socketRef = useRef<ExtendedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(SOCKET_ENABLED ? null : 'Socket désactivé pour test');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;
  
  const callbacksRef = useRef<Map<string, (...args: any[]) => void>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Fonction pour déterminer l'URL du serveur Socket.IO
  const getSocketUrl = useCallback(() => {
    // Utiliser la variable d'environnement si elle existe
    if (process.env.NEXT_PUBLIC_SOCKET_URL) {
      return process.env.NEXT_PUBLIC_SOCKET_URL;
    }
    
    // En production, utiliser la même URL que l'app
    if (process.env.NODE_ENV === 'production') {
      return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    } else {
      // En développement, utiliser le serveur externe sur le port 3001
      return 'http://localhost:3001';
    }
  }, []);

  // Fonction pour vérifier si le serveur Socket.IO est disponible
  const checkSocketServer = useCallback(async () => {
    try {
      const socketUrl = getSocketUrl();
      
      // Test pour serveur externe
      const response = await fetch(`${socketUrl}/socket.io/?transport=polling&EIO=4`, { 
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (response.ok || response.status === 400) {
        console.log('✅ Serveur Socket.IO externe détecté sur:', socketUrl);
        return { available: true, type: 'external' };
      }
      
      throw new Error('Serveur Socket.IO non disponible');
    } catch (error) {
      console.error('❌ Serveur Socket.IO non disponible:', error);
      return { available: false, type: null };
    }
  }, [getSocketUrl]);

  useEffect(() => {
    if (!SOCKET_ENABLED) {
      console.log('🔇 Socket désactivé pour les tests');
      return;
    }

    const initSocket = async () => {
      if (socketRef.current?.connected) {
        console.log('Socket déjà connecté');
        return;
      }

      // Vérifier d'abord si le serveur est disponible
      const serverCheck = await checkSocketServer();
      if (!serverCheck.available) {
        setConnectionError('Serveur Socket.IO non disponible - mode hors ligne');
        console.log('⚠️ Serveur Socket.IO non disponible, mode dégradé activé');
        scheduleReconnect();
        return;
      }

      try {
        const socketUrl = getSocketUrl();
        
        console.log('🔄 Connexion Socket.IO vers:', socketUrl);
        console.log('🔧 Type de serveur:', serverCheck.type);
        
        const socket = io(socketUrl, {
          // Chemin par défaut pour serveur externe
          path: '/socket.io/',
          forceNew: false,
          transports: ['polling', 'websocket'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: maxRetries,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 5000,
          autoConnect: true,
          upgrade: true,
        }) as ExtendedSocket;

        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('✅ Socket connecté:', socket.id);
          setIsConnected(true);
          setConnectionError(null);
          setRetryCount(0);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
        });

        socket.on('disconnect', (reason) => {
          console.log('❌ Socket déconnecté:', reason);
          setIsConnected(false);
          
          if (reason === 'io server disconnect' || reason === 'transport close') {
            scheduleReconnect();
          }
        });

        socket.on('connect_error', (error) => {
          const errorMessage = error?.message || error?.toString() || 'Erreur de connexion inconnue';
          console.error('🚫 Erreur connexion:', errorMessage);
          setIsConnected(false);
          
          setRetryCount(prev => {
            const newCount = prev + 1;
            if (newCount >= maxRetries) {
              setConnectionError('Impossible de se connecter - mode hors ligne');
              console.log('🚫 Max tentatives atteint, passage en mode hors ligne');
            } else {
              setConnectionError(`Tentative ${newCount}/${maxRetries} - ${errorMessage}`);
              scheduleReconnect();
            }
            return newCount;
          });
        });

        socket.on('reconnect', (attemptNumber) => {
          console.log('🔄 Reconnexion réussie après', attemptNumber, 'tentatives');
          setIsConnected(true);
          setConnectionError(null);
          setRetryCount(0);
        });

        socket.on('reconnect_error', (error) => {
          console.error('🚫 Erreur de reconnexion:', error.message);
        });

        socket.on('reconnect_failed', () => {
          console.error('🚫 Échec de reconnexion après toutes les tentatives');
          setConnectionError('Reconnexion impossible - mode hors ligne');
        });

        // Timeout de sécurité pour la connexion initiale
        const connectionTimeout = setTimeout(() => {
          if (!socket.connected) {
            console.log('⚠️ Timeout de connexion - tentative de reconnexion');
            setConnectionError('Timeout de connexion - nouvelle tentative...');
            scheduleReconnect();
          }
        }, 25000);

        socket.on('connect', () => {
          clearTimeout(connectionTimeout);
        });

        // Configuration des handlers
        const handleReceiveMessage = (data: SocketMessage) => {
          console.log('📩 Message reçu via socket:', data);
          const callback = callbacksRef.current.get('onReceiveMessage');
          if (callback) callback(data);
        };

        const handleUserTyping = (data: TypingData) => {
          console.log('⌨️ User typing via socket:', data);
          const callback = callbacksRef.current.get('onUserTyping');
          if (callback) callback(data);
        };

        const handleUserStopTyping = (data: StopTypingData) => {
          console.log('⏸️ User stop typing via socket:', data);
          const callback = callbacksRef.current.get('onUserStopTyping');
          if (callback) callback(data);
        };

        const handleUserStatusChange = (data: UserStatusData) => {
          console.log('👤 User status change via socket:', data);
          const callback = callbacksRef.current.get('onUserStatusChange');
          if (callback) callback(data);
        };

        const handleMessageSent = (data: any) => {
          console.log('✅ Message sent confirmation via socket:', data);
          const callback = callbacksRef.current.get('onMessageSent');
          if (callback) callback(data);
        };

        socket.on('receive-message', handleReceiveMessage);
        socket.on('user-typing', handleUserTyping);
        socket.on('user-stop-typing', handleUserStopTyping);
        socket.on('user-status-change', handleUserStatusChange);
        socket.on('message-sent', handleMessageSent);

        socket.handlers = {
          handleReceiveMessage,
          handleUserTyping,
          handleUserStopTyping,
          handleUserStatusChange,
          handleMessageSent
        };

        return () => {
          clearTimeout(connectionTimeout);
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur d\'initialisation socket';
        console.error('🚫 Erreur initialisation socket:', errorMessage);
        setConnectionError(errorMessage);
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (retryCount < maxRetries) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Tentative de reconnexion ${retryCount + 1}/${maxRetries}...`);
          initSocket();
        }, Math.min(3000 * Math.pow(2, retryCount), 30000));
      }
    };

    initSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        console.log('🧹 Nettoyage socket complet');
        
        const handlers = socketRef.current.handlers;
        if (handlers) {
          socketRef.current.off('receive-message', handlers.handleReceiveMessage);
          socketRef.current.off('user-typing', handlers.handleUserTyping);
          socketRef.current.off('user-stop-typing', handlers.handleUserStopTyping);
          socketRef.current.off('user-status-change', handlers.handleUserStatusChange);
          socketRef.current.off('message-sent', handlers.handleMessageSent);
        }
        
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      callbacksRef.current.clear();
    };
  }, [maxRetries, getSocketUrl, checkSocketServer]);

  const registerUser = useCallback((userId: string) => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) {
      if (!SOCKET_ENABLED) console.log('🔇 Socket désactivé - registerUser ignoré');
      else console.log('⚠️ Socket non connecté - registerUser ignoré');
      return;
    }
    console.log('📝 Enregistrement utilisateur:', userId);
    socketRef.current.emit('register-user', userId);
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) {
      if (!SOCKET_ENABLED) console.log('🔇 Socket désactivé - joinConversation ignoré');
      else console.log('⚠️ Socket non connecté - joinConversation ignoré');
      return;
    }
    console.log('👥 Rejoindre conversation:', conversationId);
    socketRef.current.emit('join-conversation', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) {
      if (!SOCKET_ENABLED) console.log('🔇 Socket désactivé - leaveConversation ignoré');
      else console.log('⚠️ Socket non connecté - leaveConversation ignoré');
      return;
    }
    console.log('👋 Quitter conversation:', conversationId);
    socketRef.current.emit('leave-conversation', conversationId);
  }, []);

  const sendMessage = useCallback((messageData: SocketMessage) => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) {
      if (!SOCKET_ENABLED) console.log('🔇 Socket désactivé - sendMessage ignoré');
      else console.warn('⚠️ Socket non connecté pour envoi message');
      return;
    }
    console.log('📤 Envoi message via socket:', messageData.id);
    socketRef.current.emit('send-message', messageData);
  }, []);

  const startTyping = useCallback((conversationId: string, userId: string, username: string) => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) return;
    console.log('⌨️ Start typing:', { conversationId, userId, username });
    socketRef.current.emit('typing', { conversationId, userId, username });
  }, []);

  const stopTyping = useCallback((conversationId: string, userId: string) => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) return;
    console.log('⏸️ Stop typing:', { conversationId, userId });
    socketRef.current.emit('stop-typing', { conversationId, userId });
  }, []);

  const markAsRead = useCallback((conversationId: string, userId: string) => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) return;
    socketRef.current.emit('mark-as-read', { conversationId, userId });
  }, []);

  const ping = useCallback(() => {
    if (!SOCKET_ENABLED || !socketRef.current?.connected) return;
    socketRef.current.emit('ping');
  }, []);

  const reconnect = useCallback(() => {
    if (!SOCKET_ENABLED) return;
    console.log('🔄 Reconnexion manuelle');
    setRetryCount(0);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  // Fonctions pour enregistrer les callbacks
  const onReceiveMessage = useCallback((callback: (data: SocketMessage) => void) => {
    callbacksRef.current.set('onReceiveMessage', callback);
    return () => callbacksRef.current.delete('onReceiveMessage');
  }, []);

  const onUserTyping = useCallback((callback: (data: TypingData) => void) => {
    callbacksRef.current.set('onUserTyping', callback);
    return () => callbacksRef.current.delete('onUserTyping');
  }, []);

  const onUserStopTyping = useCallback((callback: (data: StopTypingData) => void) => {
    callbacksRef.current.set('onUserStopTyping', callback);
    return () => callbacksRef.current.delete('onUserStopTyping');
  }, []);

  const onUserStatusChange = useCallback((callback: (data: UserStatusData) => void) => {
    callbacksRef.current.set('onUserStatusChange', callback);
    return () => callbacksRef.current.delete('onUserStatusChange');
  }, []);

  const onMessageSent = useCallback((callback: (data: any) => void) => {
    callbacksRef.current.set('onMessageSent', callback);
    return () => callbacksRef.current.delete('onMessageSent');
  }, []);

  const removeAllListeners = useCallback(() => {
    console.log('🧹 Suppression de tous les callbacks');
    callbacksRef.current.clear();
  }, []);

  return {
    isConnected,           // ← Export important pour le contexte
    connectionError,
    retryCount,
    maxRetries,
    
    registerUser,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    ping,
    reconnect,
    
    onReceiveMessage,      // ← Export important pour écouter les messages
    onUserTyping,
    onUserStopTyping,
    onUserStatusChange,
    onMessageSent,
    removeAllListeners,
  };
};