"use client";

import { Comment, User } from "@/generated/prisma";
import { addComment, addReply, switchCommentLike, deleteComment } from "@/lib/action";
import { useUser } from "@clerk/nextjs";
import Image from "next/image"
import { useOptimistic, useState, useEffect, useRef, startTransition } from "react";
import Link from "next/link"
import { formatPostDate } from "@/utils/formatPostDate"
import CommentInfo from "./CommentInfo";
import CommentLikesModal from "./CommentLikesModal";
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import UserHoverCard from "../UserHoverCard";

type CommentWithUser = Comment & {
    user: User
} & {
    likes: { userId: string }[]
} & {
    _count: { likes: number, replies?: number }
} & {
    replies?: CommentWithUser[]
}

type UserSuggestion = {
    id: string;
    username: string;
    avatar: string;
    name?: string;
};

const CommentList = ({ comments, postId }: { comments: CommentWithUser[]; postId: number; }) => {

    const { user } = useUser()
    const [commentState, setCommentState] = useState(comments)
    const [desc, setDesc] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [showAllComments, setShowAllComments] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    // États pour les réponses
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
    const [showReplies, setShowReplies] = useState<Record<number, boolean>>({});
    const [replyEmojiPicker, setReplyEmojiPicker] = useState<number | null>(null);
    const [replyCursorPositions, setReplyCursorPositions] = useState<Record<number, number>>({});
    const replyInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // État pour gérer les likes de chaque commentaire
    const [commentLikes, setCommentLikes] = useState<Record<number, { count: number; isLiked: boolean }>>({});

    // États pour le système de tag - commentaire principal
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);
    const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
    const [currentMention, setCurrentMention] = useState("");
    const [mentionStartPos, setMentionStartPos] = useState(-1);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const userSuggestionsRef = useRef<HTMLDivElement>(null);

    // États pour le système de tag - réponses
    const [replyUserSuggestions, setReplyUserSuggestions] = useState<Record<number, UserSuggestion[]>>({});
    const [replyCurrentMention, setReplyCurrentMention] = useState<Record<number, string>>({});
    const [replyMentionStartPos, setReplyMentionStartPos] = useState<Record<number, number>>({});
    const [replyLoadingSuggestions, setReplyLoadingSuggestions] = useState<Record<number, boolean>>({});
    const [showReplyUserSuggestions, setShowReplyUserSuggestions] = useState<Record<number, boolean>>({});
    const replyUserSuggestionsRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // Fonction pour formater le texte avec les mentions
    const formatTextWithMentions = (text: string) => {
        const parts = text.split(/(@\w+)/g);

        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                const username = part.slice(1);
                return (
                    <UserHoverCard key={index} username={username}>
                        <Link
                            href={`/profile/${username}`}
                            className="text-blue-500 rounded-md hover:underline transition-all duration-200 py-0 font-medium"
                        >
                            {part}
                        </Link>
                    </UserHoverCard>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    // Initialiser les likes quand les commentaires ou l'utilisateur changent
    useEffect(() => {
        const initialLikes: Record<number, { count: number; isLiked: boolean }> = {};

        const processComments = (comments: CommentWithUser[]) => {
            comments.forEach(comment => {
                initialLikes[comment.id] = {
                    count: comment._count?.likes || comment.likes?.length || 0,
                    isLiked: user ? comment.likes?.some(like => like.userId === user.id) || false : false
                };

                // Traiter les réponses
                if (comment.replies) {
                    processComments(comment.replies);
                }
            });
        };

        processComments(commentState);
        setCommentLikes(initialLikes);
    }, [commentState, user]);

    // Fermer les pickers et suggestions si on clique ailleurs
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
                setReplyEmojiPicker(null);
            }

            // Fermer les suggestions utilisateurs du commentaire principal
            if (userSuggestionsRef.current && !userSuggestionsRef.current.contains(event.target as Node) &&
                inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setShowUserSuggestions(false);
                setCurrentMention("");
                setMentionStartPos(-1);
            }

            // Fermer les suggestions utilisateurs des réponses
            Object.keys(replyUserSuggestionsRefs.current).forEach(commentIdStr => {
                const commentId = parseInt(commentIdStr);
                const suggestionsRef = replyUserSuggestionsRefs.current[commentId];
                const inputRef = replyInputRefs.current[commentId];

                if (suggestionsRef && !suggestionsRef.contains(event.target as Node) &&
                    inputRef && !inputRef.contains(event.target as Node)) {
                    setShowReplyUserSuggestions(prev => ({ ...prev, [commentId]: false }));
                    setReplyCurrentMention(prev => ({ ...prev, [commentId]: "" }));
                    setReplyMentionStartPos(prev => ({ ...prev, [commentId]: -1 }));
                }
            });
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Rechercher des utilisateurs pour les suggestions
    const searchUsers = async (query: string, isReply: boolean = false, commentId?: number) => {
        if (query.length === 0) {
            if (isReply && commentId) {
                setReplyUserSuggestions(prev => ({ ...prev, [commentId]: [] }));
                setShowReplyUserSuggestions(prev => ({ ...prev, [commentId]: false }));
            } else {
                setUserSuggestions([]);
                setShowUserSuggestions(false);
            }
            return;
        }

        if (isReply && commentId) {
            setReplyLoadingSuggestions(prev => ({ ...prev, [commentId]: true }));
        } else {
            setLoadingSuggestions(true);
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.ok) {
                const data = await response.json();
                const suggestions = Array.isArray(data) ? data.slice(0, 6) : [];

                if (isReply && commentId) {
                    setReplyUserSuggestions(prev => ({ ...prev, [commentId]: suggestions }));
                    setShowReplyUserSuggestions(prev => ({ ...prev, [commentId]: true }));
                } else {
                    setUserSuggestions(suggestions);
                    setShowUserSuggestions(true);
                }
            }
        } catch (error) {
            console.error("Error searching users:", error);
            if (isReply && commentId) {
                setReplyUserSuggestions(prev => ({ ...prev, [commentId]: [] }));
                setShowReplyUserSuggestions(prev => ({ ...prev, [commentId]: false }));
            } else {
                setUserSuggestions([]);
                setShowUserSuggestions(false);
            }
        } finally {
            if (isReply && commentId) {
                setReplyLoadingSuggestions(prev => ({ ...prev, [commentId]: false }));
            } else {
                setLoadingSuggestions(false);
            }
        }
    };

    // Gérer les changements dans l'input du commentaire principal
    const handleCommentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Gérer les changements dans l'input des réponses
    const handleReplyInputChange = (e: React.ChangeEvent<HTMLInputElement>, commentId: number) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart || 0;

        setReplyTexts(prev => ({ ...prev, [commentId]: value }));
        setReplyCursorPositions(prev => ({ ...prev, [commentId]: cursorPos }));

        // Détecter si on tape "@"
        const textBeforeCursor = value.slice(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

            // Vérifier si c'est une mention valide (pas d'espace entre @ et le curseur)
            if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                setReplyCurrentMention(prev => ({ ...prev, [commentId]: textAfterAt }));
                setReplyMentionStartPos(prev => ({ ...prev, [commentId]: lastAtIndex }));
                searchUsers(textAfterAt, true, commentId);
            } else {
                setShowReplyUserSuggestions(prev => ({ ...prev, [commentId]: false }));
                setReplyCurrentMention(prev => ({ ...prev, [commentId]: "" }));
                setReplyMentionStartPos(prev => ({ ...prev, [commentId]: -1 }));
            }
        } else {
            setShowReplyUserSuggestions(prev => ({ ...prev, [commentId]: false }));
            setReplyCurrentMention(prev => ({ ...prev, [commentId]: "" }));
            setReplyMentionStartPos(prev => ({ ...prev, [commentId]: -1 }));
        }
    };

    // Sélectionner un utilisateur depuis les suggestions - commentaire principal
    const selectUser = (selectedUser: UserSuggestion) => {
        if (mentionStartPos !== -1) {
            const beforeMention = desc.slice(0, mentionStartPos);
            const afterMention = desc.slice(mentionStartPos + currentMention.length + 1);
            const newText = beforeMention + `@${selectedUser.username} ` + afterMention;

            setDesc(newText);
            setShowUserSuggestions(false);
            setCurrentMention("");
            setMentionStartPos(-1);

            // Remettre le focus sur l'input
            setTimeout(() => {
                if (inputRef.current) {
                    const newPosition = mentionStartPos + selectedUser.username.length + 2;
                    inputRef.current.setSelectionRange(newPosition, newPosition);
                    inputRef.current.focus();
                    setCursorPosition(newPosition);
                }
            }, 0);
        }
    };

    // Sélectionner un utilisateur depuis les suggestions - réponses
    const selectReplyUser = (selectedUser: UserSuggestion, commentId: number) => {
        const currentStartPos = replyMentionStartPos[commentId];
        const currentMentionText = replyCurrentMention[commentId];
        const currentText = replyTexts[commentId] || '';

        if (currentStartPos !== -1) {
            const beforeMention = currentText.slice(0, currentStartPos);
            const afterMention = currentText.slice(currentStartPos + currentMentionText.length + 1);
            const newText = beforeMention + `@${selectedUser.username} ` + afterMention;

            setReplyTexts(prev => ({ ...prev, [commentId]: newText }));
            setShowReplyUserSuggestions(prev => ({ ...prev, [commentId]: false }));
            setReplyCurrentMention(prev => ({ ...prev, [commentId]: "" }));
            setReplyMentionStartPos(prev => ({ ...prev, [commentId]: -1 }));

            // Remettre le focus sur l'input
            setTimeout(() => {
                const inputEl = replyInputRefs.current[commentId];
                if (inputEl) {
                    const newPosition = currentStartPos + selectedUser.username.length + 2;
                    inputEl.setSelectionRange(newPosition, newPosition);
                    inputEl.focus();
                    setReplyCursorPositions(prev => ({ ...prev, [commentId]: newPosition }));
                }
            }, 0);
        }
    };

    // Gérer la sélection d'emoji pour le commentaire principal
    const onEmojiClick = (emojiData: EmojiClickData) => {
        if (inputRef.current) {
            const start = cursorPosition;
            const end = cursorPosition;
            const newText = desc.slice(0, start) + emojiData.emoji + desc.slice(end);

            setDesc(newText);

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

    // Gérer la sélection d'emoji pour les réponses
    const onReplyEmojiClick = (emojiData: EmojiClickData, commentId: number) => {
        const currentText = replyTexts[commentId] || '';
        const currentPosition = replyCursorPositions[commentId] || 0;

        const newText = currentText.slice(0, currentPosition) + emojiData.emoji + currentText.slice(currentPosition);

        setReplyTexts(prev => ({
            ...prev,
            [commentId]: newText
        }));

        setTimeout(() => {
            const inputEl = replyInputRefs.current[commentId];
            if (inputEl) {
                const newPosition = currentPosition + emojiData.emoji.length;
                inputEl.setSelectionRange(newPosition, newPosition);
                inputEl.focus();
                setReplyCursorPositions(prev => ({
                    ...prev,
                    [commentId]: newPosition
                }));
            }
        }, 0);

        setReplyEmojiPicker(null);
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

    const handleReplyInputClick = (commentId: number) => {
        const inputEl = replyInputRefs.current[commentId];
        if (inputEl) {
            setReplyCursorPositions(prev => ({
                ...prev,
                [commentId]: inputEl.selectionStart || 0
            }));
        }
    };

    const handleReplyInputKeyUp = (commentId: number) => {
        const inputEl = replyInputRefs.current[commentId];
        if (inputEl) {
            setReplyCursorPositions(prev => ({
                ...prev,
                [commentId]: inputEl.selectionStart || 0
            }));
        }
    };

    const add = async () => {
        if (!user || !desc) return;

        const optimisticComment = {
            id: Math.random(),
            desc,
            createdAt: new Date(Date.now()),
            updateAt: new Date(Date.now()),
            userId: user.id,
            postId: postId,
            parentId: null,
            likes: [],
            _count: { likes: 0, replies: 0 },
            replies: [],
            user: {
                id: user.id,
                username: "Sending please wait ...",
                avatar: user.imageUrl || "/noAvatar.png",
                cover: "",
                description: "",
                name: "",
                surname: "",
                city: "",
                work: "",
                school: "",
                website: "",
                createdAt: new Date(Date.now()),
            }
        };

        // Utiliser startTransition pour la mise à jour optimiste
        startTransition(() => {
            addOptimisticComment(optimisticComment);
        });

        try {
            const createdComment = await addComment(postId, desc);

            const commentWithExtras: CommentWithUser = {
                ...createdComment,
                likes: [],
                _count: { likes: 0, replies: 0 },
                replies: []
            };

            setCommentState((prev) => [commentWithExtras, ...prev]);

            setCommentLikes(prev => ({
                ...prev,
                [createdComment.id]: { count: 0, isLiked: false }
            }));

            setDesc("");
        } catch (err) {
            // En cas d'erreur, vous pourriez vouloir retirer le commentaire optimiste
            console.error("Error adding comment:", err);
        }
    }

    // Fonction pour ajouter une réponse
    const addReplyToComment = async (parentId: number) => {
        if (!user || !replyTexts[parentId]) return;

        try {
            const createdReply = await addReply(postId, parentId, replyTexts[parentId]);

            const replyWithExtras: CommentWithUser = {
                ...createdReply,
                likes: [],
                _count: { likes: 0 },
                replies: []
            };

            // Mettre à jour l'état pour ajouter la réponse au commentaire parent
            setCommentState(prev => prev.map(comment => {
                if (comment.id === parentId) {
                    return {
                        ...comment,
                        replies: [...(comment.replies || []), replyWithExtras],
                        _count: {
                            ...comment._count,
                            replies: (comment._count.replies || 0) + 1
                        }
                    };
                }
                return comment;
            }));

            // Initialiser les likes pour la nouvelle réponse
            setCommentLikes(prev => ({
                ...prev,
                [createdReply.id]: { count: 0, isLiked: false }
            }));

            // Réinitialiser les champs de réponse
            setReplyTexts(prev => ({
                ...prev,
                [parentId]: ""
            }));
            setReplyingTo(null);

            // Afficher les réponses automatiquement
            setShowReplies(prev => ({
                ...prev,
                [parentId]: true
            }));

        } catch (err) {
            console.error("Error adding reply:", err);
        }
    };

    const [optimisticComments, addOptimisticComment] = useOptimistic(commentState,
        (state, value: CommentWithUser) => [value, ...state]
    )

    // Synchroniser optimisticComments avec commentState après les suppressions
    const displayComments = optimisticComments.length !== commentState.length ? commentState : optimisticComments;

    const handleDeleteComment = (commentId: number) => {
        setCommentState(prev => prev.filter(comment => comment.id !== commentId));
        setCommentLikes(prev => {
            const newState = { ...prev };
            delete newState[commentId];
            return newState;
        });
    }

    // Fonction pour gérer les likes des commentaires
    const handleCommentLike = async (commentId: number) => {
        if (!user) return;

        const currentState = commentLikes[commentId] || { count: 0, isLiked: false };

        setCommentLikes(prev => ({
            ...prev,
            [commentId]: {
                count: currentState.isLiked ? currentState.count - 1 : currentState.count + 1,
                isLiked: !currentState.isLiked
            }
        }));

        try {
            await switchCommentLike(commentId);

            setCommentState(prev => {
                const updateCommentLikes = (comments: CommentWithUser[]): CommentWithUser[] => {
                    return comments.map(comment => {
                        if (comment.id === commentId) {
                            const newLikes = currentState.isLiked
                                ? comment.likes.filter(like => like.userId !== user.id)
                                : [...comment.likes, { userId: user.id }];

                            return {
                                ...comment,
                                likes: newLikes,
                                _count: { ...comment._count, likes: newLikes.length }
                            };
                        }

                        // Vérifier dans les réponses
                        if (comment.replies) {
                            return {
                                ...comment,
                                replies: updateCommentLikes(comment.replies)
                            };
                        }

                        return comment;
                    });
                };

                return updateCommentLikes(prev);
            });

        } catch (error) {
            console.error("Error liking comment:", error);
            setCommentLikes(prev => ({
                ...prev,
                [commentId]: currentState
            }));
        }
    }
    const handleDeleteReply = (parentId: number, replyId: number) => {
        console.log('Deleting reply:', replyId, 'from parent:', parentId);

        // Mettre à jour commentState 
        setCommentState(prev => {
            const updatedComments = prev.map(comment => {
                if (comment.id === parentId) {
                    const updatedReplies = comment.replies?.filter(reply => reply.id !== replyId) || [];
                    return {
                        ...comment,
                        replies: updatedReplies,
                        _count: {
                            ...comment._count,
                            replies: Math.max((comment._count.replies || 0) - 1, 0)
                        }
                    };
                }
                return comment;
            });

            return updatedComments;
        });

        // Nettoyer les likes du commentaire supprimé
        setCommentLikes(prev => {
            const newState = { ...prev };
            delete newState[replyId];
            return newState;
        });
    };

    // Trier les commentaires par nombre de likes (ordre décroissant)
    const sortedComments = [...displayComments].sort((a, b) => {
        const aLikes = commentLikes[a.id]?.count || a._count?.likes || a.likes?.length || 0;
        const bLikes = commentLikes[b.id]?.count || b._count?.likes || b.likes?.length || 0;
        return bLikes - aLikes;
    });

    const commentsToShow = showAllComments ? sortedComments : sortedComments.slice(0, 2);
    const remainingCommentsCount = sortedComments.length - 2;

    // Composant pour rendre un commentaire (utilisé récursivement)
    const renderComment = (comment: CommentWithUser, isReply: boolean = false) => {
        const likeState = commentLikes[comment.id] || { count: 0, isLiked: false };
        const hasReplies = comment.replies && comment.replies.length > 0;
        const replyCount = comment._count?.replies || comment.replies?.length || 0;

        return (
            <div key={comment.id} className={`flex gap-4 mb-0 ${isReply ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''}`}>


                <div className="flex flex-col flex-1 justify-between">
                    <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2 justify-between">
                            <UserHoverCard username={comment.user.username}>
                                <Link href={`/profile/${comment.user.username}`}>
                                    <Image
                                        src={comment.user.avatar || "/noAvatar.png"}
                                        alt=""
                                        width={40}
                                        height={40}
                                        className="w-8 h-8 rounded-full mt-[70%]"
                                    />
                                </Link>
                            </UserHoverCard>

                            <div>
                                <UserHoverCard username={comment.user.username}>
                                    <Link href={`/profile/${comment.user.username}`}>
                                        <span className="text-[15px] font-[600] text-black">
                                            {comment.user.name && comment.user.surname
                                                ? comment.user.name + " " + comment.user.surname
                                                : comment.user.username}
                                        </span>
                                    </Link>
                                </UserHoverCard>
                            </div>

                            <div>
                                <span className="text-[12px] font-[400] text-[#86868b]">
                                    {formatPostDate(new Date(comment.createdAt))}
                                </span>
                            </div>
                        </div>

                        {user?.id === comment.userId && (
                            <div className="right-0 relative">
                                <CommentInfo
                                    commentId={comment.id}
                                    onDelete={handleDeleteComment}
                                    isReply={isReply}
                                    parentId={isReply ? comment.parentId : undefined}
                                    onDeleteReply={handleDeleteReply}
                                />
                            </div>
                        )}

                    </div>


                    <div className="font-[400] ml-10 text-black text-[14px] mb-2 text-left">
                        {formatTextWithMentions(comment.desc)}
                    </div>

                    <div className="flex items-center gap-8 text-sm text-gray-500 mt-3 ml-10">

                        <div className="flex items-center gap-2">
                            <button onClick={() => handleCommentLike(comment.id)} disabled={!user}>
                                <Image
                                    src={likeState.isLiked ? "/liked.png" : "/like.png"}
                                    alt=""
                                    width={12}
                                    height={12}
                                    className="cursor-pointer w-4 h-4"
                                />
                            </button>
                            <CommentLikesModal likeCount={likeState.count} commentId={comment.id} />
                        </div>

                        {!isReply && user && (
                            <button
                                onClick={() => {
                                    setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                    if (replyingTo !== comment.id) {
                                        setTimeout(() => {
                                            replyInputRefs.current[comment.id]?.focus();
                                        }, 0);
                                    }
                                }}
                                className="text-gray-500 font-[400] cursor-pointer text-xs hover:text-gray-700"
                            >
                                Reply
                            </button>
                        )}

                        {hasReplies && (
                            <button
                                onClick={() => setShowReplies(prev => ({
                                    ...prev,
                                    [comment.id]: !prev[comment.id]
                                }))}
                                className="text-gray-500 font-[400] cursor-pointer text-xs hover:text-gray-700"
                            >
                                {showReplies[comment.id] ? 'Hide replies' : `Show replies (${replyCount})`}
                            </button>
                        )}
                    </div>

                    {/* Formulaire de réponse */}
                    {replyingTo === comment.id && (
                        <div className="mt-3 flex items-center gap-4 relative">
                            <Image
                                src={user?.imageUrl || "/noAvatar.png"}
                                alt=""
                                width={32}
                                height={32}
                                className="w-6 h-6 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1 relative">
                                <div className="flex mt-2 items-center justify-between bg-slate-100 rounded-xl font-[400] text-sm px-4 py-2">
                                    <input
                                        ref={(el) => {
                                            replyInputRefs.current[comment.id] = el;
                                        }}
                                        type="text"
                                        placeholder={`Reply to ${comment.user.name || comment.user.username}...`}
                                        className="bg-transparent outline-none flex-1 text-black text-sm"
                                        value={replyTexts[comment.id] || ''}
                                        onChange={(e) => handleReplyInputChange(e, comment.id)}
                                        onClick={() => handleReplyInputClick(comment.id)}
                                        onKeyUp={() => handleReplyInputKeyUp(comment.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addReplyToComment(comment.id);
                                            }
                                            if (e.key === 'Escape') {
                                                setReplyingTo(null);
                                            }
                                        }}
                                    />
                                    <div className="relative">
                                        <Image
                                            src="/emoji.png"
                                            alt=""
                                            width={16}
                                            height={16}
                                            className="cursor-pointer"
                                            onClick={() => setReplyEmojiPicker(
                                                replyEmojiPicker === comment.id ? null : comment.id
                                            )}
                                        />

                                        {replyEmojiPicker === comment.id && (
                                            <div
                                                className="absolute bottom-8 right-0 z-50 shadow-lg rounded-lg"
                                                style={{ zIndex: 1000 }}
                                            >
                                                <EmojiPicker
                                                    onEmojiClick={(emojiData) => onReplyEmojiClick(emojiData, comment.id)}
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

                                {/* Suggestions d'utilisateurs pour les réponses */}
                                {showReplyUserSuggestions[comment.id] && replyCurrentMention[comment.id] !== undefined && (
                                    <div
                                        ref={(el) => {
                                            replyUserSuggestionsRefs.current[comment.id] = el;
                                        }}
                                        className="absolute top-full left-8 mt-1 min-w-[320px] bg-[#f5f5f7]/45 backdrop-blur-[9.4px] border-[1px] border-solid border-[#e3e3e3] rounded-[20px] shadow-lg z-50 max-h-[200px] overflow-y-auto"
                                    >
                                        {replyLoadingSuggestions[comment.id] ? (
                                            <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                                                Search...
                                            </div>
                                        ) : replyUserSuggestions[comment.id]?.length > 0 ? (
                                            <div className="py-1">
                                                {replyUserSuggestions[comment.id].map((suggestedUser) => (
                                                    <button
                                                        key={suggestedUser.id}
                                                        className="flex items-center w-full px-3 py-2 hover:bg-[#f5f5f7]/50 cursor-pointer text-left"
                                                        onClick={() => selectReplyUser(suggestedUser, comment.id)}
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
                                                            <p className="text-sm font-medium font-normale text-gray-900">@{suggestedUser.username}</p>
                                                            {suggestedUser.name && (
                                                                <p className="text-gray-500 font-normale text-xs">{suggestedUser.name}</p>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : replyCurrentMention[comment.id] && replyCurrentMention[comment.id].length > 0 ? (
                                            <div className="px-3 py-2 text-sm text-gray-500 font-normale">
                                                No user found for "@{replyCurrentMention[comment.id]}"
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Affichage des réponses */}
                    {showReplies[comment.id] && comment.replies && comment.replies.length > 0 && (
                        <div className="mt-4">
                            {comment.replies.map((reply) => renderComment(reply, true))}
                        </div>
                    )}


                </div>
            </div>
        );
    };

    return (
        <div className=''>
            {/* WRITE COMMENT */}
            {user && (
                <div className="flex items-center gap-4 mb-6">
                    <Image
                        src={user.imageUrl || "/noAvatar.png"}
                        alt=""
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1 relative">
                        <div className="flex items-center justify-between bg-slate-100 rounded-xl font-[400] text-sm px-4 py-2">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Write a comment..."
                                className="bg-transparent outline-none flex-1 text-black text-sm"
                                value={desc}
                                onChange={handleCommentInputChange}
                                onClick={handleInputClick}
                                onKeyUp={handleInputKeyUp}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        add();
                                    }
                                }}
                            />
                            <div className="relative">
                                <Image
                                    src="/emoji.png"
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="cursor-pointer"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                />

                                {showEmojiPicker && (
                                    <div
                                        ref={emojiPickerRef}
                                        className="absolute bottom-8 right-0 z-50 shadow-lg rounded-lg"
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

                        {/* Suggestions d'utilisateurs pour le commentaire principal */}
                        {showUserSuggestions && currentMention !== undefined && (
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
                                                    <p className="text-sm font-medium text-gray-900">@{suggestedUser.username}</p>
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
                </div>
            )}

            {/* EXISTING COMMENTS */}
            <div className="">
                {commentsToShow.map((comment) => renderComment(comment))}

                {!showAllComments && remainingCommentsCount > 0 && (
                    <button
                        onClick={() => setShowAllComments(true)}
                        className="text-gray-500 text-sm mt-4 hover:text-gray-700"
                    >
                        Show {remainingCommentsCount} more comment{remainingCommentsCount > 1 ? 's' : ''}
                    </button>
                )}

                {showAllComments && sortedComments.length > 2 && (
                    <button
                        onClick={() => setShowAllComments(false)}
                        className="text-gray-500 text-sm mt-4 hover:text-gray-700"
                    >
                        Show less
                    </button>
                )}
            </div>
        </div>
    )
}

export default CommentList