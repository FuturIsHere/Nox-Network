// server.js - Serveur Socket.IO séparé
const { Server } = require('socket.io');
const http = require('http');

// Déterminer le port
const PORT = process.env.SOCKET_PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001);

// Créer le serveur HTTP
const server = http.createServer();

// Initialiser Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.NEXT_PUBLIC_APP_URL] 
      : ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  path: '/socket.io/', // Chemin par défaut
});

// Store des utilisateurs connectés
const connectedUsers = new Map(); // socketId -> userId
const userSockets = new Map(); // userId -> Set of socketIds
const conversationRooms = new Map(); // conversationId -> Set of socketIds
const userProfiles = new Map(); // userId -> { username, name, surname, avatar }

console.log(`🚀 Démarrage du serveur Socket.IO sur le port ${PORT}...`);

io.on('connection', (socket) => {
  console.log('🔗 Nouvelle connexion Socket.IO:', socket.id);

  // Enregistrement d'un utilisateur
  socket.on('register-user', async (userData) => {
    let userId, userProfile;
    
    if (typeof userData === 'string') {
      // Ancienne version : juste l'userId
      userId = userData;
    } else {
      // Nouvelle version : objet avec profil complet
      userId = userData.userId || userData.id;
      userProfile = {
        username: userData.username,
        name: userData.name,
        surname: userData.surname,
        avatar: userData.avatar
      };
    }
    
    console.log('📝 Enregistrement utilisateur:', userId, 'socket:', socket.id);
    
    // Ajouter cette socket à l'utilisateur
    connectedUsers.set(socket.id, userId);
    
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Stocker le profil utilisateur si fourni
    if (userProfile) {
      userProfiles.set(userId, userProfile);
    }

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
    
    socket.leave(conversationId);
    
    if (conversationRooms.has(conversationId)) {
      conversationRooms.get(conversationId).delete(socket.id);
      if (conversationRooms.get(conversationId).size === 0) {
        conversationRooms.delete(conversationId);
      }
    }
  });

  // Envoi de message avec données enrichies pour les notifications
  socket.on('send-message', async (messageData) => {
    console.log('📤 Diffusion message vers conversation:', messageData.conversationId);
    console.log('📄 Données du message:', messageData);
    
    const senderId = messageData.senderId;
    const senderProfile = userProfiles.get(senderId);
    
    // Enrichir les données du message avec des infos pour les notifications
    const enrichedMessage = {
      ...messageData,
      // Assurer que ces champs sont présents pour le contexte UnreadMessages
      senderId: messageData.senderId,
      conversationId: messageData.conversationId,
      content: messageData.content,
      createdAt: messageData.createdAt || new Date().toISOString(),
      id: messageData.id,
      type: messageData.type || 'TEXT',
      mediaUrl: messageData.mediaUrl || null,
      
      // Ajouter des infos sur l'expéditeur pour les notifications
      senderName: senderProfile ? 
        (senderProfile.name && senderProfile.surname ? 
          `${senderProfile.name} ${senderProfile.surname}` : 
          senderProfile.username) : 
        'Utilisateur',
      senderUsername: senderProfile?.username || 'unknown',
      senderAvatar: senderProfile?.avatar || null
    };
    
    console.log('📤 Message enrichi:', {
      id: enrichedMessage.id,
      senderId: enrichedMessage.senderId,
      senderName: enrichedMessage.senderName,
      conversationId: enrichedMessage.conversationId,
      content: enrichedMessage.content?.substring(0, 50) + '...'
    });
    
    // Diffuser le message à tous les membres de la conversation sauf l'expéditeur
    socket.to(messageData.conversationId).emit('receive-message', enrichedMessage);
    
    // Confirmer à l'expéditeur
    socket.emit('message-sent', { 
      messageId: messageData.id, 
      status: 'delivered',
      timestamp: enrichedMessage.createdAt
    });
  });

  // Événements de frappe
  socket.on('typing', (data) => {
    console.log('⌨️ User typing:', data);
    socket.to(data.conversationId).emit('user-typing', data);
  });

  socket.on('stop-typing', (data) => {
    console.log('⏸️ User stop typing:', data);
    socket.to(data.conversationId).emit('user-stop-typing', data);
  });

  // Marquer comme lu
  socket.on('mark-as-read', (data) => {
    console.log('👀 Marquer comme lu:', data);
    socket.to(data.conversationId).emit('message-read', {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  // Ping/Pong pour maintenir la connexion
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  // Événement pour récupérer les utilisateurs en ligne
  socket.on('get-online-users', () => {
    const onlineUserIds = Array.from(userSockets.keys());
    socket.emit('online-users', onlineUserIds);
  });

  // Déconnexion
  socket.on('disconnect', (reason) => {
    console.log('❌ Déconnexion socket:', socket.id, 'raison:', reason);
    
    const userId = connectedUsers.get(socket.id);
    if (userId) {
      // Retirer cette socket de l'utilisateur
      connectedUsers.delete(socket.id);
      
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        
        // Si l'utilisateur n'a plus de sockets connectées
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
          userProfiles.delete(userId); // Nettoyer aussi le profil
          
          // Notifier les autres de la déconnexion
          socket.broadcast.emit('user-status-change', {
            userId,
            isOnline: false,
            timestamp: new Date().toISOString()
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

  // Gestion des erreurs
  socket.on('error', (error) => {
    console.error('🚫 Erreur socket:', error);
  });

  // Événement de test pour debugging
  socket.on('test-notification', (data) => {
    console.log('🧪 Test notification:', data);
    socket.emit('test-response', { 
      message: 'Test reçu', 
      data, 
      timestamp: new Date().toISOString() 
    });
  });
});

// Statistiques du serveur (optionnel)
setInterval(() => {
  const stats = {
    connectedSockets: io.engine.clientsCount,
    connectedUsers: userSockets.size,
    activeConversations: conversationRooms.size,
    timestamp: new Date().toISOString()
  };
  console.log('📊 Statistiques serveur:', stats);
}, 60000); // Toutes les minutes

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`✅ Serveur Socket.IO en écoute sur le port ${PORT}`);
  console.log(`🌐 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
});

// Gestion des erreurs du serveur
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Le port ${PORT} est déjà utilisé`);
    process.exit(1);
  } else {
    console.error('❌ Erreur serveur:', error);
  }
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur Socket.IO...');
  io.close(() => {
    server.close(() => {
      console.log('✅ Serveur Socket.IO arrêté proprement');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Arrêt du serveur Socket.IO (Ctrl+C)...');
  io.close(() => {
    server.close(() => {
      console.log('✅ Serveur Socket.IO arrêté proprement');
      process.exit(0);
    });
  });
});