"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowLeft, Phone, Video, Info, Smile, Image, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import MessageUploadWidget from '../MessageUploadWidget';

const checkExistingConversation = async (otherUserId: string) => {
  try {
    const response = await fetch(`/api/messages/check-conversation?otherUserId=${otherUserId}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return { exists: false, wasDeleted: false };
  } catch (error) {
    console.error('Error checking conversation:', error);
    return { exists: false, wasDeleted: false };
  }
};

interface User {
    id: string;
    username: string;
    name?: string | null;
    surname?: string | null;
    avatar?: string | null;
}

interface TempConversationProps {
    otherUserId: string;
}

const TempConversation: React.FC<TempConversationProps> = ({ otherUserId }) => {
    const router = useRouter();
    const { user } = useUser();
    const [newMessage, setNewMessage] = useState('');
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // États pour l'upload de médias
    const [pendingMediaUrl, setPendingMediaUrl] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);

    // États pour l'emoji picker
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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

    useEffect(() => {
        // Charger les informations de l'autre utilisateur
        const fetchOtherUser = async () => {
            try {
                const response = await fetch(`/api/users/${otherUserId}`);
                if (response.ok) {
                    const userData = await response.json();
                    setOtherUser(userData);
                } else {
                    console.error('Utilisateur non trouvé');
                    router.push('/messages');
                }
            } catch (error) {
                console.error('Erreur lors du chargement de l\'utilisateur:', error);
                router.push('/messages');
            } finally {
                setLoading(false);
            }
        };

        if (otherUserId) {
            fetchOtherUser();
        }
    }, [otherUserId, router]);

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

    // Suivre la position du curseur
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

    // 🔥 MODIFIÉ : Fonction d'envoi du premier message avec support des médias
    const sendFirstMessage = async () => {
        if ((!newMessage.trim() && !pendingMediaUrl) || sendingMessage || !otherUser) return;

        setSendingMessage(true);
        const messageContent = newMessage;
        const mediaUrl = pendingMediaUrl;
        
        // Réinitialiser immédiatement l'interface
        setNewMessage('');
        setPendingMediaUrl('');

        console.log('Sending first message:', messageContent, 'with media:', mediaUrl, 'to user:', otherUser.id);

        try {
            // 🔧 NOUVEAU : Vérifier d'abord s'il existe une conversation
            const conversationCheck = await checkExistingConversation(otherUser.id);
            
            if (conversationCheck.exists && conversationCheck.wasDeleted) {
                console.log('Found deleted conversation, will restore it:', conversationCheck.conversationId);
            } else if (conversationCheck.exists && !conversationCheck.wasDeleted) {
                console.log('Active conversation already exists, redirecting:', conversationCheck.conversationId);
                router.push(`/messages/${conversationCheck.conversationId}`);
                return;
            }

            // Créer la conversation ET envoyer le premier message avec média
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    otherUserId: otherUser.id,
                    firstMessage: messageContent,
                    mediaUrl: mediaUrl || null
                }),
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const conversation = await response.json();
                console.log('Conversation created/restored:', conversation);
                
                // Rediriger vers la conversation créée/restaurée
                router.push(`/messages/${conversation.id}`);
            } else {
                const errorData = await response.json();
                console.error('Erreur lors de la création de la conversation:', errorData);
                
                if (errorData.error === "Conversation was deleted") {
                    try {
                        const restoreResponse = await fetch(`/api/messages/${conversationCheck.conversationId}/access`, {
                            method: 'POST',
                        });
                        
                        if (restoreResponse.ok) {
                            console.log('Conversation restored, retrying...');
                            const retryResponse = await fetch('/api/messages', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    otherUserId: otherUser.id,
                                    firstMessage: messageContent,
                                    mediaUrl: mediaUrl || null
                                }),
                            });
                            
                            if (retryResponse.ok) {
                                const conversation = await retryResponse.json();
                                router.push(`/messages/${conversation.id}`);
                                return;
                            }
                        }
                    } catch (restoreError) {
                        console.error('Failed to restore conversation:', restoreError);
                    }
                }
                
                setNewMessage(messageContent);
                setPendingMediaUrl(mediaUrl);
            }
        } catch (error) {
            console.error('Erreur lors de la création de la conversation:', error);
            setNewMessage(messageContent);
            setPendingMediaUrl(mediaUrl);
        } finally {
            setSendingMessage(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        setCursorPosition(e.target.selectionStart || 0);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendFirstMessage();
        }
    };

    const getUserDisplayName = (user: User) => {
        return (user.name && user.surname) ? `${user.name} ${user.surname}` : user.username;
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
                            <img
                                src={pendingMediaUrl}
                                alt="Aperçu"
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

    if (loading) {
        return (
            <div className="h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-500">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!otherUser) {
        return (
            <div className="h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500">Utilisateur non trouvé</p>
                </div>
            </div>
        );
    }

    // Vue mobile
    if (isMobile) {
        return (
            <div className="h-screen bg-white flex flex-col rounded-[30px]">
                {/* Header conversation mobile */}
                <div className="bg-white border-b border-gray-200 p-4 flex items-center rounded-t-[30px]">
                    <button
                        onClick={() => router.push('/messages')}
                        className="mr-3 p-1"
                    >
                        <ArrowLeft size={24} />
                    </button>

                    <div className="flex items-center flex-1">
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
                                    <img src="/emoji.png" alt="Emoji" className="w-5 h-5" />
                                </button>
                                
                                {/* Emoji Picker */}
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
                            onClick={sendFirstMessage}
                            disabled={sendingMessage || (!newMessage.trim() && !pendingMediaUrl)}
                            className="p-2 bg-blue-500 rounded-full text-white disabled:opacity-50"
                        >
                            <ArrowUp size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Vue desktop
    return (
        <div className="h-screen bg-white flex rounded-[30px] shadow-md">
            {/* Zone de chat principale */}
            <div className="flex-1 flex flex-col">
                {/* Header conversation */}
                <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-[30px]">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.push('/messages')}
                            className="mr-3 p-2 hover:bg-gray-100 rounded-full"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="relative">
                            <img
                                src={otherUser.avatar || '/noAvatar.png'}
                                alt={getUserDisplayName(otherUser)}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        </div>
                        <div className="ml-3">
                            <h2 className="font-medium text-gray-900">{getUserDisplayName(otherUser)}</h2>
                            <p className="text-sm text-gray-500">@{otherUser.username}</p>
                        </div>
                    </div>
                </div>

                {/* Zone vide avec message d'incitation */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ArrowUp size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">
                            Nouvelle conversation
                        </h3>
                        <p className="text-gray-500">
                            Écrivez votre premier message à {getUserDisplayName(otherUser)}
                        </p>
                    </div>
                </div>

                {/* Prévisualisation du média en attente */}
                {renderPendingMediaPreview()}

                {/* Input */}
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
                                    <img src="/emoji.png" alt="Emoji" className="w-4 h-4" />
                                </button>
                                
                                {/* Emoji Picker */}
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
                            onClick={sendFirstMessage}
                            disabled={sendingMessage || (!newMessage.trim() && !pendingMediaUrl)}
                            className="p-2 bg-blue-500 hover:bg-blue-600 rounded-full text-white disabled:opacity-50"
                        >
                            <ArrowUp size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TempConversation;