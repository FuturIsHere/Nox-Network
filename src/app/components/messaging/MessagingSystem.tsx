"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Search, ArrowLeft, Info, Smile, Trash2, MoreHorizontal, Plus } from 'lucide-react';
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

interface User {
    id: string;
    username: string;
    name?: string;
    surname?: string;
    avatar?: string;
}

interface Message {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO';
    mediaUrl?: string;
}

interface Conversation {
    id: string;
    lastMessage?: string;
    lastMessageAt: string;
    unreadCount: number;
    otherUser: User;
    isOnline: boolean;
}

interface MessagingSystemProps {
    initialConversations?: any[];
}

const MessagingSystem: React.FC<MessagingSystemProps> = ({ initialConversations = [] }) => {
    const router = useRouter();
    const { user } = useUser();
    const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isMobile, setIsMobile] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);

    // États pour l'upload de médias
    const [pendingMediaUrl, setPendingMediaUrl] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);

    // 🔥 NOUVEAU : Utiliser le contexte simplifié
    const { 
        getFilteredUnreadCounts,
        markConversationAsRead,
        setActiveConversationId
    } = useUnreadMessages();

    // États pour l'emoji picker
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // États pour le scroll infini
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
    const [offset, setOffset] = useState<Record<string, number>>({});

    // États pour le socket
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
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (initialConversations.length > 0) {
            setConversations(initialConversations);
        } else {
            loadConversations();
        }
    }, [initialConversations]);

    // 🔥 NOUVEAU : Gestion de la conversation active simplifiée
    useEffect(() => {
        if (selectedChat) {
            console.log('🎯 [MessagingSystem] Conversation sélectionnée:', selectedChat.id);
            setActiveConversationId(selectedChat.id);
        } else {
            console.log('🎯 [MessagingSystem] Aucune conversation sélectionnée');
            setActiveConversationId(null);
        }
    }, [selectedChat, setActiveConversationId]);

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

    // Socket.IO : Enregistrement utilisateur
    useEffect(() => {
        if (isConnected && currentUserId) {
            registerUser(currentUserId);
        }
    }, [isConnected, currentUserId, registerUser]);

    // 🔥 MODIFIÉ : Gestion des nouveaux messages reçus avec marquage explicite
    useEffect(() => {
        if (isConnected && selectedChat?.id) {
            joinConversation(selectedChat.id);

            const unsubscribeReceiveMessage = onReceiveMessage((messageData: any) => {
                if (messageData.conversationId === selectedChat.id) {
                    const newMessage: Message = {
                        id: messageData.id,
                        content: messageData.content,
                        createdAt: messageData.createdAt,
                        senderId: messageData.senderId,
                        type: messageData.type,
                        mediaUrl: messageData.mediaUrl
                    };

                    setMessages(prev => {
                        const existingMessages = prev[selectedChat.id] || [];
                        const exists = existingMessages.some(msg => msg.id === newMessage.id);
                        if (exists) {
                            console.log(`Message ${newMessage.id} already exists in ${selectedChat.id}, skipping`);
                            return prev;
                        }

                        const updatedMessages = [...existingMessages, newMessage].sort(
                            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        );

                        console.log(`Added new message ${newMessage.id} to ${selectedChat.id}, total: ${updatedMessages.length}`);

                        return {
                            ...prev,
                            [selectedChat.id]: updatedMessages
                        };
                    });

                    setTimeout(() => scrollToBottom(), 100);

                    // 🔥 NOUVEAU : Marquer explicitement comme lu si la fenêtre a le focus
                    if (document.hasFocus()) {
                        console.log('📖 [MessagingSystem] Marquage explicite nouveau message');
                        markConversationAsRead(selectedChat.id);
                        markAsRead(selectedChat.id, currentUserId!);
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
                leaveConversation(selectedChat.id);
                unsubscribeReceiveMessage();
                unsubscribeStatusChange();
            };
        }
    }, [isConnected, selectedChat?.id, currentUserId, markConversationAsRead, onReceiveMessage, onUserStatusChange, joinConversation, leaveConversation, markAsRead]);

    useEffect(() => {
        return () => {
            removeAllListeners();
        };
    }, [removeAllListeners]);

    // Scroll uniquement pour les nouveaux messages envoyés
    useEffect(() => {
        if (isScrollingToBottomRef.current) {
            scrollToBottom();
            isScrollingToBottomRef.current = false;
        }
    }, [messages]);

    const loadConversations = async () => {
        setLoading(true);
        try {
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
    };

    const loadMessages = async (conversationId: string, isInitial = false) => {
        if (!isInitial && messages[conversationId]) return;

        try {
            const response = await fetch(`/api/messages/${conversationId}/messages?offset=0&limit=20`);
            if (response.ok) {
                const newMessages = await response.json();

                if (isInitial) {
                    const uniqueMessages = newMessages.filter((message: Message, index: number, self: Message[]) => 
                        index === self.findIndex(m => m.id === message.id)
                    );
                    
                    if (uniqueMessages.length !== newMessages.length) {
                        console.warn(`Found ${newMessages.length - uniqueMessages.length} duplicate messages in initial data for ${conversationId}`);
                    }

                    setMessages(prev => ({
                        ...prev,
                        [conversationId]: uniqueMessages
                    }));
                    setHasMoreMessages(prev => ({
                        ...prev,
                        [conversationId]: uniqueMessages.length === 20
                    }));
                    setOffset(prev => ({
                        ...prev,
                        [conversationId]: uniqueMessages.length
                    }));

                    setTimeout(() => scrollToBottom(), 50);
                    setTimeout(() => scrollToBottom(), 150);
                    setTimeout(() => scrollToBottom(), 300);
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement des messages:', error);
        }
    };

    // Logique de scroll infini avec gestion fluide de la position
    const loadOlderMessages = async () => {
        if (!selectedChat || loadingOlderMessages || !hasMoreMessages[selectedChat.id]) return;

        setLoadingOlderMessages(true);
        try {
            const currentOffset = offset[selectedChat.id] || 0;
            console.log(`Loading older messages for chat ${selectedChat.id} with offset: ${currentOffset}`);

            const response = await fetch(`/api/messages/${selectedChat.id}/messages?offset=${currentOffset}&limit=20`);
            if (response.ok) {
                const newMessages = await response.json();
                console.log(`Received ${newMessages.length} older messages`);

                if (newMessages.length > 0) {
                    const container = messagesContainerRef.current;
                    if (!container) return;

                    const previousScrollHeight = container.scrollHeight;
                    const previousScrollTop = container.scrollTop;

                    setMessages(prev => {
                        const existingMessages = prev[selectedChat.id] || [];
                        
                        const existingMessagesMap = new Map(existingMessages.map(msg => [msg.id, msg]));
                        
                        newMessages.forEach((msg: Message) => {
                            if (!existingMessagesMap.has(msg.id)) {
                                existingMessagesMap.set(msg.id, msg);
                            }
                        });
                        
                        const allMessages = Array.from(existingMessagesMap.values()).sort(
                            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        );
                        
                        console.log(`Total messages after merge for ${selectedChat.id}: ${allMessages.length}`);
                        
                        return {
                            ...prev,
                            [selectedChat.id]: allMessages
                        };
                    });

                    const existingMessages = getCurrentMessages();
                    const existingIds = new Set(existingMessages.map((msg: Message) => msg.id));
                    const uniqueNewMessages = newMessages.filter((msg: Message) => !existingIds.has(msg.id));

                    if (uniqueNewMessages.length > 0) {
                        setOffset(prev => ({
                            ...prev,
                            [selectedChat.id]: currentOffset + uniqueNewMessages.length
                        }));

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

                setHasMoreMessages(prev => ({
                    ...prev,
                    [selectedChat.id]: newMessages.length === 20
                }));
            }
        } catch (error) {
            console.error('Erreur lors du chargement des anciens messages:', error);
        } finally {
            setLoadingOlderMessages(false);
        }
    };

    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container || !selectedChat) return;

        const threshold = 200;
        const isNearTop = container.scrollTop <= threshold;

        if (isNearTop && hasMoreMessages[selectedChat.id] && !loadingOlderMessages) {
            console.log(`Triggering load at scrollTop: ${container.scrollTop}`);
            loadOlderMessages();
        }
    }, [selectedChat, hasMoreMessages, loadingOlderMessages, messages]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    // 🔥 MODIFIÉ : Fonction pour sélectionner une conversation avec marquage explicite
    const selectChat = async (conversation: Conversation) => {
        console.log('🎯 [MessagingSystem] Sélection conversation:', conversation.id);
        
        setSelectedChat(conversation);

        // Marquer explicitement comme lue
        await markConversationAsRead(conversation.id);

        // Réinitialiser les états d'upload
        setPendingMediaUrl('');
        setIsUploading(false);

        if (!messages[conversation.id]) {
            await loadMessages(conversation.id, true);
        } else {
            setTimeout(() => {
                scrollToBottom();
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                }
            }, 100);
        }
    };

    const scrollToBottom = () => {
        const container = messagesContainerRef.current;
        if (container) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;

                setTimeout(() => {
                    if (container.scrollTop !== container.scrollHeight - container.clientHeight) {
                        container.scrollTop = container.scrollHeight;
                    }
                }, 50);
            });
        }
    };

    useEffect(() => {
        if (selectedChat && messages[selectedChat.id]) {
            setTimeout(() => scrollToBottom(), 100);
        }
    }, [selectedChat?.id]);

    // 🔥 NOUVEAU : Gestion de l'upload de médias
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

    const clearPendingMedia = () => {
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

    // 🔥 MODIFIÉ : Fonction d'envoi de message avec support des médias
    const sendMessage = async () => {
        if ((!newMessage.trim() && !pendingMediaUrl) || !selectedChat || sendingMessage || !currentUserId) return;

        setSendingMessage(true);
        const messageContent = newMessage;
        const mediaUrl = pendingMediaUrl;
        
        // Réinitialiser immédiatement l'interface
        setNewMessage('');
        setPendingMediaUrl('');

        try {
            const response = await fetch(`/api/messages/${selectedChat.id}/messages`, {
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

                setMessages(prev => {
                    const existingMessages = prev[selectedChat.id] || [];
                    const exists = existingMessages.some(msg => msg.id === newMessageData.id);
                    if (exists) {
                        console.log(`Sent message ${newMessageData.id} already exists in ${selectedChat.id}, skipping local add`);
                        return prev;
                    }

                    const updatedMessages = [...existingMessages, newMessageData].sort(
                        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );

                    console.log(`Added sent message ${newMessageData.id} to ${selectedChat.id}, total: ${updatedMessages.length}`);

                    return {
                        ...prev,
                        [selectedChat.id]: updatedMessages
                    };
                });

                if (isConnected && sendSocketMessage) {
                    sendSocketMessage({
                        ...newMessageData,
                        conversationId: selectedChat.id
                    });
                }

                setConversations(prev => prev.map(conv =>
                    conv.id === selectedChat.id
                        ? { ...conv, lastMessage: messageContent || '📎 Média', lastMessageAt: new Date().toISOString() }
                        : conv
                ));

                isScrollingToBottomRef.current = true;
            } else {
                console.error('Erreur lors de l\'envoi du message');
                setNewMessage(messageContent);
                setPendingMediaUrl(mediaUrl);
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
            setNewMessage(messageContent);
            setPendingMediaUrl(mediaUrl);
        } finally {
            setSendingMessage(false);
        }
    };

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

            setConversations(prev => prev.filter(conv => conv.id !== conversationId));
            
            if (selectedChat?.id === conversationId) {
                setSelectedChat(null);
            }

            setTimeout(() => {
                loadConversations();
            }, 500);

        } catch (error) {
            console.error('Erreur lors de la suppression de la conversation:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
            alert(`Erreur: ${errorMessage}`);
            throw error;
        }
    };

    // 🔥 NOUVEAU : Fonction de suppression de message avec nettoyage média
    const handleDeleteMessage = async (messageId: string) => {
        if (!selectedChat) return;
        
        try {
            const result = await deleteMessageWithMedia(messageId);

            setMessages(prev => {
                const existingMessages = prev[selectedChat.id] || [];
                const filteredMessages = existingMessages.filter(msg => msg.id !== messageId);
                console.log(`Deleted message ${messageId} from ${selectedChat.id}, remaining: ${filteredMessages.length}`);
                
                return {
                    ...prev,
                    [selectedChat.id]: filteredMessages
                };
            });

            if (result.conversationDeleted) {
                console.log(`Conversation supprimée définitivement: ${result.reason}`);
                
                setConversations(prev => prev.filter(conv => conv.id !== selectedChat.id));
                setSelectedChat(null);
                
                await loadConversations();
            }
        } catch (error) {
            console.error('Erreur lors de la suppression du message:', error);
            throw error;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        setCursorPosition(e.target.selectionStart || 0);
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

    const filteredConversations = conversations.filter(conv =>
        conv.otherUser.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.otherUser.surname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getCurrentMessages = (): Message[] => {
        if (!selectedChat) return [];
        return messages[selectedChat.id] || [];
    };

    const getUserDisplayName = (user: User) => {
        return (user.name && user.surname) ? `${user.name} ${user.surname}` : user.username;
    };

    const goToNewConversation = () => {
        router.push('/messages/new');
    };

    // 🔥 NOUVEAU : Rendu de la prévisualisation du média en attente
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

    // 🔥 MODIFIÉ : Utiliser les compteurs filtrés
    const renderConversationItem = (conv: Conversation) => {
        const filteredCounts = getFilteredUnreadCounts();
        const unreadCount = filteredCounts[conv.id] || 0;
        
        return (
            <div
                key={conv.id}
                onClick={() => selectChat(conv)}
                className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedChat?.id === conv.id ? 'bg-gray-50' : ''
                } ${isMobile ? 'border-b border-gray-100' : ''}`}
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
                        <h3 className="font-medium text-gray-900 truncate flex-1 mr-2">
                            {getUserDisplayName(conv.otherUser)}
                        </h3>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatTime(conv.lastMessageAt)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate flex-1 mr-2">
                            {conv.lastMessage}
                        </p>
                        {unreadCount > 0 && (
                            <UnreadBadge count={unreadCount} />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-500">Chargement des conversations...</p>
                </div>
            </div>
        );
    }

    // Vue mobile : liste des conversations
    if (isMobile && !selectedChat) {
        return (
            <div className="h-screen bg-white flex flex-col rounded-[30px]">
                <div className="bg-white border-b border-gray-200 p-4 rounded-t-[30px]">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-semibold">Messages</h1>
                        <div className="flex items-center gap-2">
                            <button onClick={goToNewConversation} className="p-2">
                                <Image src="/pencil.png" alt="" width={25} height={25} />
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConversations.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <p className="text-gray-500 mb-4">Aucune conversation</p>
                                <button
                                    onClick={goToNewConversation}
                                    className="bg-blue-500 text-white px-4 py-2 rounded-full"
                                >
                                    Nouvelle conversation
                                </button>
                            </div>
                        </div>
                    ) : (
                        filteredConversations.map((conv) => renderConversationItem(conv))
                    )}
                </div>
            </div>
        );
    }

    // Vue mobile : conversation sélectionnée
    if (isMobile && selectedChat) {
        return (
            <div className="h-screen bg-white flex flex-col shadow-md rounded-[30px]">
                <ConversationHeader
                    selectedChat={selectedChat}
                    onlineUsers={onlineUsers}
                    onDeleteConversation={handleDeleteConversation}
                    onBack={() => setSelectedChat(null)}
                    isMobile={true}
                />

                <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
                >
                    {loadingOlderMessages && (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                    )}

                    {getCurrentMessages().map((message: Message, index: number) => {
                        const currentMessages = getCurrentMessages();
                        const showTimestamp = index === 0 ||
                            (index > 0 &&
                                Math.abs(new Date(message.createdAt).getTime() - new Date(currentMessages[index - 1].createdAt).getTime()) > 10 * 60 * 1000
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

                <div className="bg-white border-t border-gray-200 p-4 rounded-b-[30px] relative">
                    <div className="flex items-center gap-2">
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
                        
                        <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 py-2">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Votre message..."
                                value={newMessage}
                                onChange={handleInputChange}
                                onKeyPress={handleKeyPress}
                                onClick={handleInputClick}
                                onKeyUp={handleInputKeyUp}
                                disabled={sendingMessage}
                                className="flex-1 bg-transparent text-sm focus:outline-none"
                            />
                            <div className="relative">
                                <button 
                                    className="ml-2"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                >
                                    <Image src="/emoji.png" alt="Emoji" width={20} height={20} />
                                </button>
                                
                                {showEmojiPicker && (
                                    <div
                                        ref={emojiPickerRef}
                                        className="absolute bottom-full right-0 mb-2 z-50 shadow-lg rounded-lg"
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
                            className="p-2 bg-blue-500 rounded-full text-white disabled:opacity-50"
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
                        <div className="flex items-center gap-2">
                            <button
                                onClick={goToNewConversation}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <Image src="/pencil.png" alt="" width={25} height={25} />
                            </button>
                        </div>
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
                    {filteredConversations.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <p className="text-gray-500 mb-4">Aucune conversation</p>
                                <button
                                    onClick={goToNewConversation}
                                    className="bg-blue-500 text-white px-4 py-2 rounded-full"
                                >
                                    Nouvelle conversation
                                </button>
                            </div>
                        </div>
                    ) : (
                        filteredConversations.map((conv) => renderConversationItem(conv))
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                {selectedChat ? (
                    <>
                        <ConversationHeader
                            selectedChat={selectedChat}
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

                            {getCurrentMessages().map((message: Message, index: number) => {
                                const currentMessages = getCurrentMessages();
                                const showTimestamp = index === 0 ||
                                    (index > 0 &&
                                        Math.abs(new Date(message.createdAt).getTime() - new Date(currentMessages[index - 1].createdAt).getTime()) > 10 * 60 * 1000
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

                        <div className="bg-white border-t border-gray-200 p-4 rounded-b-[30px] relative">
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
                                
                                <div className="flex-1 border border-gray-300 rounded-full flex items-center px-4 py-2">
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
                                        
                                        {showEmojiPicker && (
                                            <div
                                                ref={emojiPickerRef}
                                                className="absolute bottom-full right-0 mb-2 z-50 shadow-lg rounded-lg"
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
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4">
                                <Image 
                                          src="/message.png" 
                                          alt="Messages" 
                                          width={220} 
                                          height={220} 
                                          className="w-full h-full object-contain" 
                                        />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">Vos Messages</h3>
                            <p className="text-gray-500 mb-4">Envoyez des messages privés à vos amis</p>
                            <button
                                onClick={goToNewConversation}
                                className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600"
                            >
                                Nouvelle conversation
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagingSystem;