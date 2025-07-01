// src/app/api/socket.js
import { Server } from 'socket.io';

export default function handler(req, res) {
  if (res.socket.server.io) {
    console.log('✅ Socket.IO déjà initialisé');
    res.end();
    return;
  }

  console.log('🚀 Initialisation Socket.IO dans Next.js...');
  
  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.NEXT_PUBLIC_APP_URL] 
        : ["http://localhost:3000", "http://127.0.0.1:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
  });

  // Store des utilisateurs connectés
  const connectedUsers = new Map(); // socketId -> userId
  const userSockets = new Map(); // userId -> Set of socketIds
  const conversationRooms = new Map(); // conversationId -> Set of socketIds
  
  // ✅ NOUVEAU : Store pour les timeouts de typing
  const typingTimeouts = new Map(); // userId-conversationId -> timeout
  const activeTyping = new Map(); // userId-conversationId -> { username, timestamp }

  io.on('connection', (socket) => {
    console.log('🔗 Nouvelle connexion Socket.IO:', socket.id);

    // Enregistrement d'un utilisateur
    socket.on('register-user', (userId) => {
      console.log('📝 Enregistrement utilisateur:', userId, 'socket:', socket.id);
      
      // Ajouter cette socket à l'utilisateur
      connectedUsers.set(socket.id, userId);
      
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);

      // Notifier les autres de la connexion
      socket.broadcast.emit('user-status-change', {
        userId,
        isOnline: true
      });
    });

    // Rejoindre une conversation
    socket.on('join-conversation', (conversationId) => {
      console.log('👥 Socket', socket.id, 'rejoint la conversation:', conversationId);
      
      socket.join(conversationId);
      
      if (!conversationRooms.has(conversationId)) {
        conversationRooms.set(conversationId, new Set());
      }
      conversationRooms.get(conversationId).add(socket.id);
    });

    // Quitter une conversation
    socket.on('leave-conversation', (conversationId) => {
      console.log('👋 Socket', socket.id, 'quitte la conversation:', conversationId);
      
      const userId = connectedUsers.get(socket.id);
      
      // ✅ NOUVEAU : Nettoyer le typing pour cette conversation
      if (userId) {
        const timeoutKey = `${userId}-${conversationId}`;
        
        if (typingTimeouts.has(timeoutKey)) {
          clearTimeout(typingTimeouts.get(timeoutKey));
          typingTimeouts.delete(timeoutKey);
        }
        
        if (activeTyping.has(timeoutKey)) {
          const typingData = activeTyping.get(timeoutKey);
          socket.to(conversationId).emit('user-stop-typing', {
            userId,
            username: typingData.username,
            conversationId
          });
          activeTyping.delete(timeoutKey);
        }
      }
      
      socket.leave(conversationId);
      
      if (conversationRooms.has(conversationId)) {
        conversationRooms.get(conversationId).delete(socket.id);
        if (conversationRooms.get(conversationId).size === 0) {
          conversationRooms.delete(conversationId);
        }
      }
    });

    // Envoi de message
    socket.on('send-message', (messageData) => {
      console.log('📤 Diffusion message vers conversation:', messageData.conversationId);
      
      // ✅ NOUVEAU : Auto-stop typing quand un message est envoyé
      const userId = connectedUsers.get(socket.id);
      if (userId) {
        const timeoutKey = `${userId}-${messageData.conversationId}`;
        
        if (typingTimeouts.has(timeoutKey)) {
          clearTimeout(typingTimeouts.get(timeoutKey));
          typingTimeouts.delete(timeoutKey);
        }
        
        if (activeTyping.has(timeoutKey)) {
          const typingData = activeTyping.get(timeoutKey);
          socket.to(messageData.conversationId).emit('user-stop-typing', {
            userId,
            username: typingData.username,
            conversationId: messageData.conversationId
          });
          activeTyping.delete(timeoutKey);
        }
      }
      
      // Diffuser le message à tous les membres de la conversation sauf l'expéditeur
      socket.to(messageData.conversationId).emit('receive-message', messageData);
      
      // Confirmer à l'expéditeur
      socket.emit('message-sent', { 
        messageId: messageData.id, 
        status: 'delivered' 
      });
    });

    // ✅ AMÉLIORÉ : Gestion du typing
    socket.on('typing', (data) => {
      console.log('⌨️ User typing:', data);
      
      if (!data.userId || !data.conversationId || !data.username) {
        console.warn('⚠️ Données de typing invalides:', data);
        return;
      }
      
      const timeoutKey = `${data.userId}-${data.conversationId}`;
      
      // Nettoyer le timeout existant pour cet utilisateur/conversation
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey));
      }
      
      // Marquer comme actif
      activeTyping.set(timeoutKey, {
        username: data.username,
        timestamp: Date.now()
      });
      
      // Diffuser l'événement de typing
      socket.to(data.conversationId).emit('user-typing', data);
      
      // ✅ Programmer un arrêt automatique après 5 secondes (sécurité côté serveur)
      const autoStopTimeout = setTimeout(() => {
        console.log('⏰ Auto-stop typing côté serveur pour:', data.userId);
        
        socket.to(data.conversationId).emit('user-stop-typing', {
          userId: data.userId,
          username: data.username,
          conversationId: data.conversationId
        });
        
        typingTimeouts.delete(timeoutKey);
        activeTyping.delete(timeoutKey);
      }, 5000);
      
      typingTimeouts.set(timeoutKey, autoStopTimeout);
    });

    // ✅ AMÉLIORÉ : Arrêt du typing
    socket.on('stop-typing', (data) => {
      console.log('⏸️ User stop typing:', data);
      
      if (!data.userId || !data.conversationId) {
        console.warn('⚠️ Données de stop-typing invalides:', data);
        return;
      }
      
      const timeoutKey = `${data.userId}-${data.conversationId}`;
      
      // Nettoyer le timeout automatique
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey));
        typingTimeouts.delete(timeoutKey);
      }
      
      // Récupérer le username depuis activeTyping si pas fourni
      let username = data.username;
      if (!username && activeTyping.has(timeoutKey)) {
        username = activeTyping.get(timeoutKey).username;
      }
      
      // Nettoyer le typing actif
      activeTyping.delete(timeoutKey);
      
      // Diffuser l'arrêt du typing avec plus d'informations
      socket.to(data.conversationId).emit('user-stop-typing', {
        userId: data.userId,
        username: username || 'Utilisateur',
        conversationId: data.conversationId
      });
    });

    // Marquer comme lu
    socket.on('mark-as-read', (data) => {
      console.log('👀 Marquer comme lu:', data);
      
      if (data.conversationId && data.userId) {
        socket.to(data.conversationId).emit('message-read', data);
      }
    });

    // Ping/Pong pour maintenir la connexion
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // ✅ AMÉLIORÉ : Déconnexion avec nettoyage complet
    socket.on('disconnect', (reason) => {
      console.log('❌ Déconnexion socket:', socket.id, 'raison:', reason);
      
      const userId = connectedUsers.get(socket.id);
      if (userId) {
        console.log('🧹 Nettoyage pour utilisateur:', userId);
        
        // ✅ Nettoyer tous les timeouts de typing pour cet utilisateur
        const keysToDelete = [];
        for (const [timeoutKey, timeout] of typingTimeouts.entries()) {
          if (timeoutKey.startsWith(`${userId}-`)) {
            clearTimeout(timeout);
            keysToDelete.push(timeoutKey);
            
            // Notifier l'arrêt du typing pour toutes ses conversations
            const conversationId = timeoutKey.split('-').slice(1).join('-'); // Support des IDs avec tirets
            if (conversationId && activeTyping.has(timeoutKey)) {
              const typingData = activeTyping.get(timeoutKey);
              socket.to(conversationId).emit('user-stop-typing', {
                userId,
                username: typingData.username,
                conversationId
              });
            }
          }
        }
        
        // Nettoyer les Maps
        keysToDelete.forEach(key => {
          typingTimeouts.delete(key);
          activeTyping.delete(key);
        });
        
        // Retirer cette socket de l'utilisateur
        connectedUsers.delete(socket.id);
        
        if (userSockets.has(userId)) {
          userSockets.get(userId).delete(socket.id);
          
          // Si l'utilisateur n'a plus de sockets connectées
          if (userSockets.get(userId).size === 0) {
            userSockets.delete(userId);
            
            // Notifier les autres de la déconnexion
            socket.broadcast.emit('user-status-change', {
              userId,
              isOnline: false
            });
          }
        }
      }

      // Nettoyer les rooms de conversation
      conversationRooms.forEach((sockets, conversationId) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            conversationRooms.delete(conversationId);
          }
        }
      });
    });

    // ✅ NOUVEAU : Nettoyage périodique des typing obsolètes (sécurité)
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToClean = [];
      
      for (const [timeoutKey, typingData] of activeTyping.entries()) {
        // Nettoyer les typing de plus de 10 secondes
        if (now - typingData.timestamp > 10000) {
          keysToClean.push(timeoutKey);
        }
      }
      
      keysToClean.forEach(key => {
        const parts = key.split('-');
        const userId = parts[0];
        const conversationId = parts.slice(1).join('-');
        
        if (typingTimeouts.has(key)) {
          clearTimeout(typingTimeouts.get(key));
          typingTimeouts.delete(key);
        }
        
        if (activeTyping.has(key)) {
          const typingData = activeTyping.get(key);
          io.to(conversationId).emit('user-stop-typing', {
            userId,
            username: typingData.username,
            conversationId
          });
          activeTyping.delete(key);
        }
      });
      
      if (keysToClean.length > 0) {
        console.log(`🧹 Nettoyage automatique de ${keysToClean.length} typing obsolètes`);
      }
    }, 30000); // Nettoyage toutes les 30 secondes

    // Nettoyer l'interval quand la socket se déconnecte
    socket.on('disconnect', () => {
      clearInterval(cleanupInterval);
    });

    // Gestion des erreurs
    socket.on('error', (error) => {
      console.error('🚫 Erreur socket:', error);
    });

    // ✅ NOUVEAU : Event pour forcer l'arrêt de tous les typing d'un utilisateur
    socket.on('force-stop-all-typing', (userId) => {
      console.log('🛑 Force stop all typing pour:', userId);
      
      const keysToDelete = [];
      for (const [timeoutKey, timeout] of typingTimeouts.entries()) {
        if (timeoutKey.startsWith(`${userId}-`)) {
          clearTimeout(timeout);
          keysToDelete.push(timeoutKey);
          
          const conversationId = timeoutKey.split('-').slice(1).join('-');
          if (conversationId && activeTyping.has(timeoutKey)) {
            const typingData = activeTyping.get(timeoutKey);
            io.to(conversationId).emit('user-stop-typing', {
              userId,
              username: typingData.username,
              conversationId
            });
          }
        }
      }
      
      keysToDelete.forEach(key => {
        typingTimeouts.delete(key);
        activeTyping.delete(key);
      });
    });
  });

  res.socket.server.io = io;
  console.log('✅ Socket.IO initialisé avec succès dans Next.js');
  res.end();
}