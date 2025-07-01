"use client"

import { useUser } from "@clerk/nextjs";
import LocalUploadWidget from "./LocalUploadWidget";
import Image from "next/image"
import { useState, useRef, useEffect } from "react";
import AddPostButton from "./AddPostButton";
import { addPost } from "@/lib/action";
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { createPortal } from "react-dom";

type User = {
  id: string;
  username: string;
  avatar: string;
  name?: string;
};

const AddPost = () => {
    const { user, isLoaded } = useUser();
    const [desc, setDesc] = useState("");
    const [img, setImg] = useState<any>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    
    // États pour le système de tag
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);
    const [userSuggestions, setUserSuggestions] = useState<User[]>([]);
    const [currentMention, setCurrentMention] = useState("");
    const [mentionStartPos, setMentionStartPos] = useState(-1);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [mounted, setMounted] = useState(false);
    const userSuggestionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fermer les pickers si on clique ailleurs
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (userSuggestionsRef.current && !userSuggestionsRef.current.contains(event.target as Node) &&
                textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
                setShowUserSuggestions(false);
                setCurrentMention("");
                setMentionStartPos(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Nettoyage automatique lors du démontage du composant
    useEffect(() => {
        return () => {
            // Nettoyer le fichier temporaire si le composant est démonté
            if (img?.temp_filename) {
                fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
                    method: 'DELETE',
                }).catch(console.error);
            }
        };
    }, [img?.temp_filename]);

    // Fonction pour vérifier si le média est une vidéo
    const isVideo = (url: string) => {
        if (!url) return false;
        // Extensions vidéo communes ou vérification du resource_type
        return url.match(/\.(mp4|webm|ogg|mov|avi|wmv|flv|m4v|3gp|mkv)(\?.*)?$/i) ||
               (img && img.resource_type === 'video');
    };

    // Rechercher des utilisateurs pour les suggestions
    const searchUsers = async (query: string) => {
        if (query.length === 0) {
            setUserSuggestions([]);
            setShowUserSuggestions(false);
            return;
        }

        setLoadingSuggestions(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.ok) {
                const data = await response.json();
                setUserSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
                setShowUserSuggestions(true);
            }
        } catch (error) {
            console.error("Error searching users:", error);
            setUserSuggestions([]);
            setShowUserSuggestions(false);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Gérer les changements dans le textarea
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart || 0;
        
        setDesc(value);
        setCursorPosition(cursorPos);

        // Détecter si on tape "@"
        const textBeforeCursor = value.slice(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
            
            // Vérifier si c'est une mention valide (pas d'espace entre @ et le curseur)
            if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                setCurrentMention(textAfterAt);
                setMentionStartPos(lastAtIndex);
                searchUsers(textAfterAt);
            } else {
                setShowUserSuggestions(false);
                setCurrentMention("");
                setMentionStartPos(-1);
            }
        } else {
            setShowUserSuggestions(false);
            setCurrentMention("");
            setMentionStartPos(-1);
        }
    };

    // Sélectionner un utilisateur depuis les suggestions
    const selectUser = (selectedUser: User) => {
        if (mentionStartPos !== -1) {
            const beforeMention = desc.slice(0, mentionStartPos);
            const afterMention = desc.slice(mentionStartPos + currentMention.length + 1);
            const newText = beforeMention + `@${selectedUser.username} ` + afterMention;
            
            setDesc(newText);
            setShowUserSuggestions(false);
            setCurrentMention("");
            setMentionStartPos(-1);
            
            // Remettre le focus sur le textarea
            setTimeout(() => {
                if (textareaRef.current) {
                    const newPosition = mentionStartPos + selectedUser.username.length + 2;
                    textareaRef.current.setSelectionRange(newPosition, newPosition);
                    textareaRef.current.focus();
                    setCursorPosition(newPosition);
                }
            }, 0);
        }
    };

    // Gérer la sélection d'emoji
    const onEmojiClick = (emojiData: EmojiClickData) => {
        if (textareaRef.current) {
            const start = cursorPosition;
            const end = cursorPosition;
            const newText = desc.slice(0, start) + emojiData.emoji + desc.slice(end);
            
            setDesc(newText);
            
            setTimeout(() => {
                if (textareaRef.current) {
                    const newPosition = start + emojiData.emoji.length;
                    textareaRef.current.setSelectionRange(newPosition, newPosition);
                    textareaRef.current.focus();
                    setCursorPosition(newPosition);
                }
            }, 0);
        }
        setShowEmojiPicker(false);
    };

    // Suivre la position du curseur
    const handleTextareaClick = () => {
        if (textareaRef.current) {
            setCursorPosition(textareaRef.current.selectionStart || 0);
        }
    };

    const handleTextareaKeyUp = () => {
        if (textareaRef.current) {
            setCursorPosition(textareaRef.current.selectionStart || 0);
        }
    };

    // Fonction pour annuler l'upload et nettoyer
    const cancelUpload = async () => {
        if (img?.temp_filename) {
            try {
                await fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
                    method: 'DELETE',
                });
                console.log('🗑️ Fichier temporaire nettoyé lors de l\'annulation');
            } catch (error) {
                console.error('Erreur lors du nettoyage:', error);
            }
        }
        setImg(null);
    };

    // Gérer les erreurs d'upload avec nettoyage
    const handleUploadError = async (error: any) => {
        console.error("Upload error:", error);
        
        // Nettoyer le fichier temporaire en cas d'erreur
        if (img?.temp_filename) {
            try {
                await fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
                    method: 'DELETE',
                });
            } catch (cleanupError) {
                console.error('Erreur lors du nettoyage:', cleanupError);
            }
        }
        
        alert("Erreur lors de l'upload du fichier");
        setImg(null);
    };

    if (!isLoaded) {
        return "Loading ...";
    }

    return (
        <div className='p-4 bg-white rounded-[30px] shadow-md flex gap-4 justify-between flex-col relative'>
            <div className="flex">
                <Image
                    src={user?.imageUrl || "/noAvatar.png"}
                    alt="User avatar"
                    className="w-12 h-12 object-cover mr-4 rounded-full"
                    width={48}
                    height={48}
                />
                <form
                    action={async (formData) => {
                        console.log("📝 Form submitted with:", { img: img?.secure_url, desc });
                        
                        try {
                            // Passer l'URL temporaire - elle sera finalisée dans addPost
                            await addPost(formData, img?.secure_url || "");
                            
                            // Nettoyer l'état local seulement après succès
                            setImg(null);
                            setDesc("");
                            console.log("✅ Post créé avec succès");
                        } catch (error) {
                            console.error("❌ Erreur lors de la création du post:", error);
                            
                            // En cas d'erreur, nettoyer le fichier temporaire
                            if (img?.temp_filename) {
                                fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
                                    method: 'DELETE',
                                }).catch(console.error);
                            }
                        }
                    }}
                    className="flex gap-4 flex-1"
                >
                    <div className="relative flex-1">
                        <textarea
                            ref={textareaRef}
                            placeholder="What's Up ?"
                            className="w-full bg-slate-100 rounded-[20px] min-h-[72px] p-3"
                            name="desc"
                            value={desc}
                            onChange={handleTextareaChange}
                            onClick={handleTextareaClick}
                            onKeyUp={handleTextareaKeyUp}
                        />
                        
                        {/* Suggestions d'utilisateurs */}
                        {showUserSuggestions && currentMention.length >= 0 && (
                            <div
                                ref={userSuggestionsRef}
                                className="absolute top-full left-0 mt-1 min-w-[320px] bg-[#f5f5f7]/45 backdrop-blur-[9.4px] border-[1px] border-solid border-[#e3e3e3] rounded-[20px] shadow-lg z-50 max-h-[200px] overflow-y-auto"
                            >
                                {loadingSuggestions ? (
                                    <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                                        Search...
                                    </div>
                                ) : userSuggestions.length > 0 ? (
                                    <div className="py-1">
                                        {userSuggestions.map((suggestedUser) => (
                                            <button
                                                key={suggestedUser.id}
                                                className="flex items-center w-full px-3 py-2 hover:bg-[#f5f5f7]/50 cursor-pointer text-left"
                                                onClick={() => selectUser(suggestedUser)}
                                                type="button"
                                            >
                                                <div className="w-8 h-8 relative rounded-full overflow-hidden mr-3">
                                                    <Image
                                                        src={suggestedUser.avatar || "/noAvatar.png"}
                                                        alt={suggestedUser.username}
                                                        width={32}
                                                        height={32}
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{suggestedUser.username}</p>
                                                    {suggestedUser.name && (
                                                        <p className="text-gray-500 font-normale text-xs">{suggestedUser.name}</p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : currentMention.length > 0 ? (
                                    <div className="px-3 py-2 text-sm text-gray-500">
                                        No user found for "@{currentMention}"
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                    
                    <div className="relative">
                        <div 
                            className="cursor-pointer p-1"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <Image
                                src="/emoji.png"
                                alt="Emoji"
                                className="w-6 h-6 cursor-pointer self-end"
                                width={20}
                                height={20}
                            />
                        </div>
                        
                        {/* Emoji Picker Dropdown */}
                        {showEmojiPicker && (
                            <div 
                                ref={emojiPickerRef}
                                className="absolute top-8 right-0 z-50 shadow-lg rounded-lg"
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
                        
                        <AddPostButton />
                    </div>
                </form>
            </div>

            <div className="flex items-center justify-center w-full gap-4 mt-4 text-gray-400 mx-auto">
                <LocalUploadWidget
                    onSuccess={(result) => {
                        console.log("📁 Image upload vers dossier temporaire:", result.info);
                        setImg(result.info);
                    }}
                    onError={handleUploadError}
                    options={{
                        multiple: false,
                        resourceType: "image",
                        maxFileSize: 10000000, // 10MB
                        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
                    }}
                >
                    {({ open }) => (
                        <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => open()}
                        >
                            <Image src="/addimage.png" alt="Add image" className="w-13 h-13" width={65} height={65} />
                            Photo
                        </div>
                    )}
                </LocalUploadWidget>
                
                <LocalUploadWidget
                    onSuccess={(result) => {
                        console.log("📁 Video upload vers dossier temporaire:", result.info);
                        setImg(result.info);
                    }}
                    onError={handleUploadError}
                    options={{
                        multiple: false,
                        resourceType: "video",
                        maxFileSize: 100000000, // 100MB pour les vidéos
                        clientAllowedFormats: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v', '3gp']
                    }}
                >
                    {({ open }) => (
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => open()}>
                            <Image src="/addVideo.png" alt="Add video" className="w-13 h-13" width={65} height={65} />
                            Video
                        </div>
                    )}
                </LocalUploadWidget>
            </div>

            {/* Prévisualisation du média sélectionné */}
            {img?.secure_url && (
                <div className="relative flex justify-center items-center w-full mt-3 border-t-[1px] p-3 border-[#e0e0e0]">
    
                    {isVideo(img.secure_url) ? (
                        <video
                            src={img.secure_url}
                            controls
                            className="max-w-full max-h-[300px] rounded-xl object-cover bg-black"
                            preload="metadata"
                        >
                            Votre navigateur ne supporte pas les vidéos.
                        </video>
                    ) : (
                        <Image
                            src={img.secure_url}
                            alt="Uploaded preview"
                            width={200}
                            height={200}
                            className="rounded-xl object-cover max-h-[300px]"
                        />
                    )}
                    <button
                        onClick={cancelUpload} // Utiliser cancelUpload au lieu de () => setImg(null)
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 rounded-full shadow p-1 z-10"
                        aria-label="Supprimer le média"
                        type="button"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-white"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default AddPost;