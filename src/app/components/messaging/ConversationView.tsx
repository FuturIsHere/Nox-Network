"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Search, ArrowLeft, Info, Smile, Trash2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from "next/image";
import { useSocket } from '@/hooks/useSocket';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';
import { MessageItem } from '../MessageItem';
import { ConversationHeader } from '../ConversationHeader';
import { UnreadBadge } from './UnreadBadge';
import { deleteConversationForUser, deleteMessageWithMedia } from '@/lib/action';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import MessageUploadWidget from '../MessageUploadWidget';
import { cleanupUnusedTempFile, extractTempFilename } from '@/lib/clientUploadUtils';

interface User {
  id: string;
  username: string;
  name?: string | null;
  surname?: string | null;
  avatar?: string | null;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO';
  mediaUrl?: string | null;
}

interface Conversation {
  id: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  otherUser: User;
  isOnline: boolean;
}

interface ConversationViewProps {
  conversation: Conversation;
  initialMessages: Message[];
  allConversations: Conversation[];
}

const ConversationView: React.FC<ConversationViewProps> = ({ 
  conversation, 
  initialMessages, 
  allConversations 
}) => {
  const router = useRouter();
  const { user } = useUser();
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  
  // États pour l'upload de médias
  const [pendingMediaUrl, setPendingMediaUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Utiliser le contexte simplifié
  const { 
    getFilteredUnreadCounts,
    markConversationAsRead,
    setActiveConversationId
  } = useUnreadMessages();
  
  // États pour l'emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mounted, setMounted] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // États pour le scroll infini
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  
  // États Socket.IO
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingToBottomRef = useRef(false);

  const {
    isConnected,
    registerUser,
    joinConversation,
    leaveConversation,
    sendMessage: sendSocketMessage,
    markAsRead,
    onReceiveMessage,
    onUserStatusChange,
    removeAllListeners
  } = useSocket();

  const currentUserId = user?.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Gestion du changement de conversation
  useEffect(() => {
    const previousMediaUrl = pendingMediaUrl;
    
    console.log(`🎯 [ConversationView] Conversation changée: ${conversation.id}`);
    
    // Signaler la conversation active
    setActiveConversationId(conversation.id);
    
    // Marquer explicitement comme lu
    markConversationAsRead(conversation.id);
    
    // Réinitialiser les états de messages
    const uniqueInitialMessages = initialMessages.filter((message, index, self) => 
      index === self.findIndex(m => m.id === message.id)
    );
    
    if (uniqueInitialMessages.length !== initialMessages.length) {
      console.warn(`Found ${initialMessages.length - uniqueInitialMessages.length} duplicate messages in initial data`);
    }
    
    setMessages(uniqueInitialMessages);
    setCurrentOffset(uniqueInitialMessages.length);
    setHasMoreMessages(uniqueInitialMessages.length === 20);
    setLoadingOlderMessages(false);
    
    // Nettoyer le média en attente lors du changement de conversation
    if (previousMediaUrl && previousMediaUrl.includes('/temp/')) {
      cleanupUnusedTempFile(previousMediaUrl);
    }
    
    // Réinitialiser les états d'upload
    setPendingMediaUrl('');
    setIsUploading(false);
    
    setTimeout(() => {
      scrollToBottom();
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
    
    // Nettoyer quand le composant se démonte
    return () => {
      console.log('🎯 [ConversationView] Nettoyage conversation active');
      setActiveConversationId(null);
      
      // Nettoyer le média en attente lors du démontage
      if (pendingMediaUrl && pendingMediaUrl.includes('/temp/')) {
        cleanupUnusedTempFile(pendingMediaUrl);
      }
    };
  }, [conversation.id, initialMessages, markConversationAsRead, setActiveConversationId]);

  // useEffect spécifique pour s'assurer du scroll en bas au montage initial
  useEffect(() => {
    const timer1 = setTimeout(() => scrollToBottom(), 50);
    const timer2 = setTimeout(() => scrollToBottom(), 200);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Socket.IO : Enregistrement utilisateur
  useEffect(() => {
    if (isConnected && currentUserId) {
      registerUser(currentUserId);
      joinConversation(conversation.id);
      markAsRead(conversation.id, currentUserId);
    }
  }, [isConnected, currentUserId, conversation.id, registerUser, joinConversation, markAsRead]);

  // Gestion des nouveaux messages reçus avec marquage explicite
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeReceiveMessage = onReceiveMessage((messageData: any) => {
      if (messageData.conversationId === conversation.id) {
        const newMessage: Message = {
          id: messageData.id,
          content: messageData.content,
          createdAt: messageData.createdAt,
          senderId: messageData.senderId,
          type: messageData.type,
          mediaUrl: messageData.mediaUrl
        };
        
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) {
            console.log(`Message ${newMessage.id} already exists, skipping`);
            return prev;
          }
          
          const updatedMessages = [...prev, newMessage].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          
          console.log(`Added new message ${newMessage.id}, total: ${updatedMessages.length}`);
          return updatedMessages;
        });
        
        setTimeout(() => scrollToBottom(), 100);
        
        // Marquer explicitement comme lu si la fenêtre a le focus
        if (document.hasFocus()) {
          console.log('📖 [ConversationView] Marquage explicite nouveau message');
          markConversationAsRead(conversation.id);
          markAsRead(conversation.id, currentUserId!);
        }
      }
    });

    const unsubscribeStatusChange = onUserStatusChange((data: any) => {
      setOnlineUsers(prev => {
        if (data.isOnline) {
          return prev.includes(data.userId) ? prev : [...prev, data.userId];
        } else {
          return prev.filter(id => id !== data.userId);
        }
      });
    });

    return () => {
      unsubscribeReceiveMessage();
      unsubscribeStatusChange();
      leaveConversation(conversation.id);
    };
  }, [isConnected, conversation.id, currentUserId, markConversationAsRead, onReceiveMessage, onUserStatusChange, leaveConversation, markAsRead]);

  // Nettoyage final lors du démontage
  useEffect(() => {
    return () => {
      removeAllListeners();
      // Nettoyage final du média temporaire
      if (pendingMediaUrl && pendingMediaUrl.includes('/temp/')) {
        console.log('🧹 [ConversationView] Nettoyage final à la fermeture');
        cleanupUnusedTempFile(pendingMediaUrl);
      }
    };
  }, [removeAllListeners, pendingMediaUrl]);

  // Scroll uniquement pour les nouveaux messages envoyés
  useEffect(() => {
    if (isScrollingToBottomRef.current) {
      scrollToBottom();
      isScrollingToBottomRef.current = false;
    }
  }, [messages]);

  // Fermer l'emoji picker si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debug pour vérifier les états du scroll infini
  useEffect(() => {
    console.log('📊 [ConversationView] État scroll infini:', {
      conversationId: conversation.id,
      messagesCount: messages.length,
      currentOffset,
      hasMoreMessages,
      loadingOlderMessages
    });
  }, [conversation.id, messages.length, currentOffset, hasMoreMessages, loadingOlderMessages]);

  // Fonction pour supprimer la conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      console.log(`Attempting to delete conversation: ${conversationId}`);
      
      const response = await fetch(`/api/messages/${conversationId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la suppression');
      }

      console.log('Suppression result:', result);
      
      router.push('/messages');
    } catch (error) {
      console.error('Erreur lors de la suppression de la conversation:', error);
      throw error;
    }
  };

  // Logique de scroll infini avec gestion fluide de la position
  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);
    try {
      console.log(`Loading older messages with offset: ${currentOffset}`);
      
      const response = await fetch(`/api/messages/${conversation.id}/messages?offset=${currentOffset}&limit=20`);
      if (response.ok) {
        const newMessages = await response.json();
        console.log(`Received ${newMessages.length} older messages`);
        
        if (newMessages.length > 0) {
          const container = messagesContainerRef.current;
          if (!container) return;
          
          const previousScrollHeight = container.scrollHeight;
          const previousScrollTop = container.scrollTop;
          
          setMessages(prev => {
            const existingMessagesMap = new Map(prev.map(msg => [msg.id, msg]));
            
            newMessages.forEach((msg: Message) => {
              if (!existingMessagesMap.has(msg.id)) {
                existingMessagesMap.set(msg.id, msg);
              }
            });
            
            const allMessages = Array.from(existingMessagesMap.values()).sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            
            console.log(`Total messages after merge: ${allMessages.length}`);
            return allMessages;
          });
          
          const existingIds = new Set(messages.map((msg: Message) => msg.id));
          const uniqueNewMessages = newMessages.filter((msg: Message) => !existingIds.has(msg.id));
          
          if (uniqueNewMessages.length > 0) {
            setCurrentOffset(prev => prev + uniqueNewMessages.length);
            
            requestAnimationFrame(() => {
              if (container) {
                const newScrollHeight = container.scrollHeight;
                const heightDifference = newScrollHeight - previousScrollHeight;
                const newScrollTop = previousScrollTop + heightDifference + 1;
                container.scrollTop = newScrollTop;
                
                console.log(`Scroll adjusted: ${previousScrollTop} -> ${newScrollTop}`);
              }
            });
          }
        }
        
        setHasMoreMessages(newMessages.length === 20);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des anciens messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const threshold = 200;
    const isNearTop = container.scrollTop <= threshold;
    
    if (isNearTop && hasMoreMessages && !loadingOlderMessages) {
      console.log(`Triggering load at scrollTop: ${container.scrollTop}`);
      loadOlderMessages();
    }
  }, [hasMoreMessages, loadingOlderMessages, currentOffset]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      console.log('🔄 [ConversationView] Attaching scroll listener');
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        console.log('🔄 [ConversationView] Removing scroll listener');
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  };

  // Gestion de l'upload de médias
  const handleUploadComplete = (mediaUrl: string) => {
    setPendingMediaUrl(mediaUrl);
    setIsUploading(false);
    console.log('📎 Média uploadé:', mediaUrl);
  };

  const handleUploadStart = () => {
    setIsUploading(true);
    console.log('📤 Upload en cours...');
  };

  const handleUploadError = (error: string) => {
    setIsUploading(false);
    console.error('❌ Erreur upload:', error);
    alert(`Erreur d'upload: ${error}`);
  };

  const clearPendingMedia = async () => {
    if (pendingMediaUrl) {
      console.log('🗑️ [ConversationView] Nettoyage média en attente:', pendingMediaUrl);
      
      // Nettoyer le fichier temporaire
      if (pendingMediaUrl.includes('/temp/')) {
        try {
          const tempFilename = extractTempFilename(pendingMediaUrl);
          if (tempFilename) {
            const response = await fetch('/api/cleanup-temp-messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ tempFilename }),
            });
            
            if (response.ok) {
              console.log('✅ [ConversationView] Fichier temporaire nettoyé');
            } else {
              console.warn('⚠️ [ConversationView] Échec nettoyage fichier temporaire');
            }
          }
        } catch (error) {
          console.error('❌ [ConversationView] Erreur nettoyage:', error);
        }
      }
    }
    
    setPendingMediaUrl('');
  };

  // Gérer la sélection d'emoji
  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (inputRef.current) {
      const start = cursorPosition;
      const end = cursorPosition;
      const newText = newMessage.slice(0, start) + emojiData.emoji + newMessage.slice(end);
      
      setNewMessage(newText);
      
      setTimeout(() => {
        if (inputRef.current) {
          const newPosition = start + emojiData.emoji.length;
          inputRef.current.setSelectionRange(newPosition, newPosition);
          inputRef.current.focus();
          setCursorPosition(newPosition);
        }
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const handleInputClick = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  };

  const handleInputKeyUp = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  };

  // Fonction d'envoi de message avec support des médias
  const sendMessage = async () => {
    if ((!newMessage.trim() && !pendingMediaUrl) || sendingMessage) return;

    setSendingMessage(true);
    const messageContent = newMessage;
    const mediaUrl = pendingMediaUrl;
    
    // Réinitialiser immédiatement l'interface
    setNewMessage('');
    setPendingMediaUrl('');

    try {
      const response = await fetch(`/api/messages/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: messageContent,
          type: mediaUrl ? (mediaUrl.match(/\.(mp4|webm|mov|avi|mkv)$/i) ? 'VIDEO' : 'IMAGE') : 'TEXT',
          mediaUrl: mediaUrl || null
        }),
      });

      if (response.ok) {
        const newMessageData = await response.json();
        
        console.log('✅ [ConversationView] Message envoyé avec succès:', {
          id: newMessageData.id,
          hasMedia: !!newMessageData.mediaUrl,
          mediaFinalized: newMessageData.mediaUrl && !newMessageData.mediaUrl.includes('/temp/')
        });
        
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === newMessageData.id);
          if (exists) {
            console.log(`Sent message ${newMessageData.id} already exists, skipping local add`);
            return prev;
          }
          
          const updatedMessages = [...prev, newMessageData].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          
          console.log(`Added sent message ${newMessageData.id}, total: ${updatedMessages.length}`);
          return updatedMessages;
        });
        
        if (isConnected && sendSocketMessage) {
          sendSocketMessage({
            ...newMessageData,
            conversationId: conversation.id
          });
        }
        
        isScrollingToBottomRef.current = true;
      } else {
        console.error('Erreur lors de l\'envoi du message');
        
        // En cas d'erreur, remettre les valeurs ET nettoyer le fichier temporaire si nécessaire
        setNewMessage(messageContent);
        
        if (mediaUrl && mediaUrl.includes('/temp/')) {
          // Si c'est un fichier temporaire, le remettre en pendingMediaUrl
          setPendingMediaUrl(mediaUrl);
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      
      // En cas d'erreur, gérer le nettoyage approprié
      setNewMessage(messageContent);
      
      if (mediaUrl && mediaUrl.includes('/temp/')) {
        setPendingMediaUrl(mediaUrl);
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    setNewMessage(value);
    setCursorPosition(cursorPos);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'À l\'instant';
    if (diffInMinutes < 60) return `${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} h`;
    return `${Math.floor(diffInMinutes / 1440)} j`;
  };

  // Fonction de suppression de message avec nettoyage média
  const handleDeleteMessage = async (messageId: string) => {
    try {
        const result = await deleteMessageWithMedia(messageId);

        setMessages(prev => {
          const filteredMessages = prev.filter(msg => msg.id !== messageId);
          console.log(`Deleted message ${messageId}, remaining: ${filteredMessages.length}`);
          return filteredMessages;
        });

        if (result.conversationDeleted) {
            console.log(`Conversation supprimée définitivement: ${result.reason}`);
            router.push('/messages');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
        throw error;
    }
  };

  const getUserDisplayName = (user: User) => {
    return (user.name && user.surname) ? `${user.name} ${user.surname}` : user.username;
  };

  const filteredConversations = allConversations.filter(conv =>
    conv.otherUser.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser.surname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const goToConversation = (conversationId: string) => {
    markConversationAsRead(conversationId);
    router.push(`/messages/${conversationId}`);
  };

  // Utiliser les compteurs filtrés
  const renderConversationInSidebar = (conv: any) => {
    const filteredCounts = getFilteredUnreadCounts();
    const unreadCount = filteredCounts[conv.id] || 0;
    
    return (
      <div
        key={conv.id}
        onClick={() => goToConversation(conv.id)}
        className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer ${
          conversation.id === conv.id ? 'bg-gray-50' : ''
        }`}
      >
        <div className="relative">
          <img
            src={conv.otherUser.avatar || '/noAvatar.png'}
            alt={getUserDisplayName(conv.otherUser)}
            className="w-12 h-12 rounded-full object-cover"
          />
          {conv.isOnline && (
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div>

        <div className="ml-3 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 truncate">{getUserDisplayName(conv.otherUser)}</h3>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatTime(conv.lastMessageAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 truncate flex-1 mr-2">{conv.lastMessage}</p>
            {unreadCount > 0 && (
              <UnreadBadge count={unreadCount} />
            )}
          </div>
        </div>
      </div>
    );
  };

  // Rendu de la prévisualisation du média en attente
  const renderPendingMediaPreview = () => {
    if (!pendingMediaUrl) return null;

    const isVideo = pendingMediaUrl.match(/\.(mp4|webm|mov|avi|mkv)$/i);

    return (
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        <div className="flex items-start gap-3">
          <div className="relative">
            {isVideo ? (
              <video
                src={pendingMediaUrl}
                className="w-16 h-16 object-cover rounded-lg"
                muted
              />
            ) : (
              <Image
                src={pendingMediaUrl}
                alt="Aperçu"
                width={64}
                height={64}
                className="w-16 h-16 object-cover rounded-lg"
              />
            )}
            <button
              onClick={clearPendingMedia}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              {isVideo ? 'Vidéo' : 'Image'} prête à envoyer
            </p>
            <p className="text-xs text-gray-500">
              Ajoutez un message ou envoyez directement
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="h-screen shadow-md bg-white flex flex-col rounded-[30px]">
        <ConversationHeader
          conversation={conversation}
          onlineUsers={onlineUsers}
          onDeleteConversation={handleDeleteConversation}
          onBack={() => router.push('/messages')}
          isMobile={true}
        />

        <div 
          ref={messagesContainerRef}
          className="flex-1 shadow-md overflow-y-auto p-4 space-y-3 bg-gray-50"
          style={{ 
            overflowY: 'auto',
            height: 'auto',
            minHeight: 0
          }}
        >
          {loadingOlderMessages && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {messages.map((message, index) => {
            const showTimestamp = index === 0 || 
              (index > 0 && 
                Math.abs(new Date(message.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime()) > 10 * 60 * 1000
              );

            return (
              <MessageItem
                key={message.id}
                message={message}
                currentUserId={currentUserId!}
                onDeleteMessage={handleDeleteMessage}
                showTimestamp={showTimestamp}
              />
            );
          })}
        </div>

        {/* Prévisualisation du média en attente */}
        {renderPendingMediaPreview()}

        <div className="bg-white shadow-md border-t border-gray-200 p-4 rounded-b-[30px]">
          <div className="flex items-center gap-3">
            <MessageUploadWidget
              onUploadComplete={handleUploadComplete}
              onUploadStart={handleUploadStart}
              onUploadError={handleUploadError}
              disabled={isUploading || sendingMessage}
            >
              <button 
                className={`p-2 ${isUploading ? 'opacity-50' : 'hover:bg-gray-100'} bg-[#e9e9eb] rounded-full transition-colors`}
                disabled={isUploading || sendingMessage}
              >
                {isUploading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                ) : (
                  <Plus size={20} className="text-[#7e7f85]" />
                )}
              </button>
            </MessageUploadWidget>
            
            <div className="flex-1 border border-gray-300 rounded-full flex items-center px-4 py-2 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Écrivez votre message..."
                value={newMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onClick={handleInputClick}
                onKeyUp={handleInputKeyUp}
                disabled={sendingMessage}
                className="flex-1 text-sm focus:outline-none"
              />
              <div className="relative">
                <button 
                  className="ml-2 p-1 hover:bg-gray-100 rounded-full"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Image src="/emoji.png" alt="Emoji" width={18} height={18} />
                </button>
                
                {showEmojiPicker && mounted && (
                  <div 
                    ref={emojiPickerRef}
                    className="absolute bottom-10 right-0 z-50 shadow-lg rounded-lg"
                    style={{ zIndex: 1000 }}
                  >
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      autoFocusSearch={false}
                      height={300}
                      width={280}
                      previewConfig={{
                        defaultCaption: "Choose an emoji",
                        defaultEmoji: "1f60a"
                      }}
                      searchPlaceHolder="Search for emojis..."
                      skinTonesDisabled={false}
                    />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={sendMessage}
              disabled={sendingMessage || (!newMessage.trim() && !pendingMediaUrl)}
              className="p-2 bg-blue-500 hover:bg-blue-600 rounded-full text-white disabled:opacity-50"
            >
              {sendingMessage ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vue desktop
  return (
    <div className="h-screen bg-white flex rounded-[30px] shadow-md">
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Messages</h1>
            <button 
              onClick={() => router.push('/messages/new')}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Image src="/pencil.png" alt="" width={25} height={25} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => renderConversationInSidebar(conv))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <ConversationHeader
          conversation={conversation}
          onlineUsers={onlineUsers}
          onDeleteConversation={handleDeleteConversation}
          isMobile={false}
        />

        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
        >
          {loadingOlderMessages && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {messages.map((message, index) => {
            const showTimestamp = index === 0 || 
              (index > 0 && 
                Math.abs(new Date(message.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime()) > 10 * 60 * 1000
              );

            return (
              <MessageItem
                key={message.id}
                message={message}
                currentUserId={currentUserId!}
                onDeleteMessage={handleDeleteMessage}
                showTimestamp={showTimestamp}
              />
            );
          })}
        </div>

        {/* Prévisualisation du média en attente */}
        {renderPendingMediaPreview()}

        <div className="bg-white border-t border-gray-200 p-4 rounded-b-[30px]">
          <div className="flex items-center gap-3">
            <MessageUploadWidget
              onUploadComplete={handleUploadComplete}
              onUploadStart={handleUploadStart}
              onUploadError={handleUploadError}
              disabled={isUploading || sendingMessage}
            >
              <button 
                className={`p-2 ${isUploading ? 'opacity-50' : 'hover:bg-gray-100'} bg-[#e9e9eb] rounded-full transition-colors`}
                disabled={isUploading || sendingMessage}
              >
                {isUploading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                ) : (
                 <Plus size={20} className="text-[#7e7f85]" />
                )}
              </button>
            </MessageUploadWidget>
            
            <div className="flex-1 border border-gray-300 rounded-full flex items-center px-4 py-2 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Écrivez votre message..."
                value={newMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onClick={handleInputClick}
                onKeyUp={handleInputKeyUp}
                disabled={sendingMessage}
                className="flex-1 text-sm focus:outline-none"
              />
              <div className="relative">
                <button 
                  className="ml-2 p-1 hover:bg-gray-100 rounded-full"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Image src="/emoji.png" alt="Emoji" width={18} height={18} />
                </button>
                
                {showEmojiPicker && mounted && (
                  <div 
                    ref={emojiPickerRef}
                    className="absolute bottom-10 right-0 z-50 shadow-lg rounded-lg"
                    style={{ zIndex: 1000 }}
                  >
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      autoFocusSearch={false}
                      height={350}
                      width={300}
                      previewConfig={{
                        defaultCaption: "Choose an emoji",
                        defaultEmoji: "1f60a"
                      }}
                      searchPlaceHolder="Search for emojis..."
                      skinTonesDisabled={false}
                    />
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={sendMessage}
              disabled={sendingMessage || (!newMessage.trim() && !pendingMediaUrl)}
              className="p-2 bg-blue-500 hover:bg-blue-600 rounded-full text-white disabled:opacity-50"
            >
              {sendingMessage ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationView;