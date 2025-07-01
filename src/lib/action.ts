"use server"

import { auth } from "@clerk/nextjs/server"
import prisma from "./client"
import { error } from "console"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createNotification } from './notificationService'
import { finalizeUpload, cleanupTempFile, deleteMediaFile } from './uploadUtils';

export const switchFollow = async (userId: string) => {
  const { userId: currentUserId } = auth()

  if (!currentUserId) {
    throw new Error("User is not authenticated")
  }

  try {
    const existingFollow = await prisma.follower.findFirst({
      where: {
        followerId: currentUserId,
        followingId: userId,
      }
    })

    if (existingFollow) {
      // L'utilisateur unfollow
      await prisma.follower.delete({
        where: {
          id: existingFollow.id
        },
      });

      // Supprimer la notification de suivi (quand la demande avait été acceptée)
      await prisma.notification.deleteMany({
        where: {
          type: 'FOLLOW',
          userId: currentUserId, // L'utilisateur qui avait envoyé la demande originale
          triggeredById: userId, // L'utilisateur qui avait accepté la demande
        },
      });
    } else {
      const existingFollowRequest = await prisma.followRequest.findFirst({
        where: {
          senderId: currentUserId,
          receiverId: userId,
        }
      })

      if (existingFollowRequest) {
        // Annuler la demande de suivi
        await prisma.followRequest.delete({
          where: {
            id: existingFollowRequest.id
          },
        });

        // Supprimer la notification de demande de suivi
        await prisma.notification.deleteMany({
          where: {
            type: 'FOLLOW_REQUEST',
            userId: userId,
            triggeredById: currentUserId,
          },
        });
      } else {
        // Envoyer une nouvelle demande de suivi
        await prisma.followRequest.create({
          data: {
            senderId: currentUserId,
            receiverId: userId,
          }
        });

        // Créer une notification de demande de suivi
        console.log('Creating follow request notification for user:', userId)

        const notificationResult = await createNotification({
          userId: userId,
          type: 'FOLLOW_REQUEST',
          message: 'souhaite vous suivre',
          triggeredById: currentUserId,
        });

        if (!notificationResult) {
          console.error('Failed to create follow request notification')
        }
      }
    }
  } catch (err) {
    console.error('Error in switchFollow:', err);
    throw new Error("Something went error")
  }
}

export const switchBlock = async (userId: string) => {
  const { userId: currentUserId } = auth()

  if (!currentUserId) {
    throw new Error("User is not Authenticated")
  }
  try {
    const existingBlock = await prisma.block.findFirst({
      where: {
        blockerId: currentUserId,
        blockedId: userId,

      }
    });
    if (existingBlock) {
      await prisma.block.delete({
        where: {
          id: existingBlock.id,
        },
      });
    } else {
      await prisma.block.create({
        data: {
          blockerId: currentUserId,
          blockedId: userId,
        },
      });
    }
  } catch (err) {
    console.log(err)
    throw new Error("Something went wrong")
  }
};

export const acceptFollowRequest = async (userId: string) => {
  const { userId: currentUserId } = auth()

  if (!currentUserId) {
    throw new Error("User is not Authenticated")
  }

  try {
    const existingFollowRequest = await prisma.followRequest.findFirst({
      where: {
        senderId: userId,
        receiverId: currentUserId,
      },
    });

    if (existingFollowRequest) {
      await prisma.followRequest.delete({
        where: {
          id: existingFollowRequest.id,
        },
      })
    };

    await prisma.follower.create({
      data: {
        followerId: userId,
        followingId: currentUserId,
      }
    });

    // Supprimer toutes les notifications de demande de suivi liées à cette demande
    await prisma.notification.deleteMany({
      where: {
        type: 'FOLLOW_REQUEST',
        userId: currentUserId, // L'utilisateur qui reçoit la notification (celui qui accepte)
        triggeredById: userId, // L'utilisateur qui a envoyé la demande
      },
    });

    // Créer une notification de suivi accepté
    console.log('Creating follow accepted notification for user:', userId)

    const notificationResult = await createNotification({
      userId: userId,
      type: 'FOLLOW',
      message: 'a accepté votre demande de suivi',
      triggeredById: currentUserId,
    });

    if (!notificationResult) {
      console.error('Failed to create follow accepted notification')
    }

    // IMPORTANT: Revalider le cache de Next.js
    revalidatePath('/profile/[username]/requests', 'page')
    revalidatePath('/profile')
    revalidatePath('/notifications') // Ajouter cette ligne pour revalider les notifications

  } catch (err) {
    console.error('Error in acceptFollowRequest:', err);
    throw new Error("Something went wrong ")
  }
};

export const declineFollowRequest = async (userId: string) => {
  const { userId: currentUserId } = auth()
  if (!currentUserId) {
    throw new Error("User is not Authenticated")
  }
  try {
    const existingFollowRequest = await prisma.followRequest.findFirst({
      where: {
        senderId: userId,
        receiverId: currentUserId,
      },
    });

    if (existingFollowRequest) {
      await prisma.followRequest.delete({
        where: {
          id: existingFollowRequest.id,
        },
      })
    };

    // Supprimer toutes les notifications de demande de suivi liées à cette demande
    await prisma.notification.deleteMany({
      where: {
        type: 'FOLLOW_REQUEST',
        userId: currentUserId, // L'utilisateur qui reçoit la notification (celui qui décline)
        triggeredById: userId, // L'utilisateur qui a envoyé la demande
      },
    });

    // IMPORTANT: Revalider le cache de Next.js
    revalidatePath('/profile/[username]/requests', 'page')
    revalidatePath('/profile')
    revalidatePath('/notifications') // Ajouter cette ligne pour revalider les notifications

  } catch (err) {
    console.log(err)
    throw new Error("Something went wrong ")
  }
};

export const removeFollower = async (followerId: string) => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User is not Authenticated!");
  }

  try {
    const existingFollow = await prisma.follower.findFirst({
      where: {
        followerId: followerId,
        followingId: userId,
      },
    });

    if (existingFollow) {
      await prisma.follower.delete({
        where: {
          id: existingFollow.id,
        },
      });

      // Supprimer la notification de suivi (quand la demande avait été acceptée)
      await prisma.notification.deleteMany({
        where: {
          type: 'FOLLOW',
          userId: followerId, // L'utilisateur qui avait envoyé la demande originale
          triggeredById: userId, // L'utilisateur qui avait accepté la demande (celui qui retire maintenant)
        },
      });
    }
  } catch (err) {
    console.log(err);
    throw new Error("Something went wrong!");
  }
};

export const updateProfile = async (
  prevState: { success: boolean; error: boolean },
  payload: { formData: FormData; cover: string }
) => {
  const { formData, cover } = payload;
  const fields = Object.fromEntries(formData);

  const filteredFields = Object.fromEntries(
    Object.entries(fields).filter(([_, value]) => value !== "")
  );

  const Profile = z.object({
    cover: z.string().optional(),
    name: z.string().max(60).optional(),
    surname: z.string().max(60).optional(),
    description: z.string().max(255).optional(),
    city: z.string().max(60).optional(),
    school: z.string().max(60).optional(),
    work: z.string().max(60).optional(),
    website: z.string().max(60).optional(),
  });

  const validatedFields = Profile.safeParse({ cover, ...filteredFields });

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return { success: false, error: true };
  }

  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: true };
  }

  try {
    // Récupérer l'utilisateur actuel
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    let finalCoverUrl = "";

    // 🔥 NOUVEAU : Gestion des fichiers temporaires pour la couverture
    if (cover && cover.includes('/temp/')) {
      console.log('🚀 [updateProfile] Finalisation de la couverture temporaire...');
      
      // Extraire le nom du fichier temporaire
      const tempFilename = cover.split('/temp/')[1];
      
      // Finaliser l'upload vers le dossier profiles
      const result = await finalizeUpload(tempFilename, 'profiles');
      finalCoverUrl = result.final_url;
      console.log('✅ [updateProfile] Couverture finalisée:', finalCoverUrl);
      
      // Supprimer l'ancienne photo de couverture si elle existe
      if (existingUser?.cover && existingUser.cover !== "/noAvatar.png") {
        const deleted = await deleteMediaFile(existingUser.cover);
        if (deleted) {
          console.log('🗑️ [updateProfile] Ancienne couverture supprimée');
        }
      }
      
    } else if (cover && !cover.includes('/temp/')) {
      // Si ce n'est pas un fichier temporaire, utiliser l'URL directement
      finalCoverUrl = cover;
    } else {
      // Si pas de nouvelle couverture, garder l'existante
      finalCoverUrl = existingUser?.cover || "";
    }

    // Construire les données finales
    const finalData = {
      ...validatedFields.data,
      cover: finalCoverUrl || existingUser?.cover || undefined,
    };

    // Supprimer le champ cover s'il est vide pour éviter d'écraser avec une chaîne vide
    if (!finalData.cover) {
      delete finalData.cover;
    }

    console.log('📝 [updateProfile] Mise à jour avec:', {
      ...finalData,
      cover: finalData.cover ? '✅' : '❌'
    });

    await prisma.user.update({
      where: { id: userId },
      data: finalData,
    });

    console.log('✅ [updateProfile] Profil mis à jour avec succès');
    return { success: true, error: false };
  } catch (err) {
    console.error('❌ [updateProfile] Erreur lors de la mise à jour:', err);
    
    // En cas d'erreur, nettoyer le fichier temporaire
    if (cover && cover.includes('/temp/')) {
      const tempFilename = cover.split('/temp/')[1];
      await cleanupTempFile(tempFilename);
    }
    
    return { success: false, error: true };
  }
};


export const switchLike = async (postId: number) => {
  const { userId } = await auth();

  if (!userId) throw new Error("User is not authenticated!");

  try {
    const existingLike = await prisma.like.findFirst({
      where: {
        postId,
        userId,
      },
    });

    if (existingLike) {
      // Supprimer le like
      await prisma.like.delete({
        where: {
          id: existingLike.id,
        },
      });

      // Supprimer la notification associée
      await prisma.notification.deleteMany({
        where: {
          type: 'LIKE',
          postId: postId,
          triggeredById: userId,
        },
      });
    } else {
      // Ajouter le like
      await prisma.like.create({
        data: {
          postId,
          userId,
        },
      });

      // Récupérer les informations du post pour créer la notification
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          userId: true,
          desc: true,
        },
      });

      // Créer une notification pour le propriétaire du post
      if (post && post.userId !== userId) {
        console.log('Creating like notification for user:', post.userId)

        const notificationResult = await createNotification({
          userId: post.userId,
          type: 'LIKE',
          message: 'a aimé votre publication',
          triggeredById: userId,
          postId: postId,
        });

        if (!notificationResult) {
          console.error('Failed to create like notification')
        }
      }
    }
  } catch (err) {
    console.error('Error in switchLike:', err);
    throw new Error("Something went wrong");
  }
};

export const switchCommentLike = async (commentId: number) => {
  const { userId } = await auth();

  if (!userId) throw new Error("User is not authenticated!");

  try {
    // Utiliser une transaction pour éviter les problèmes de concurrence
    await prisma.$transaction(async (tx) => {
      const existingLike = await tx.like.findFirst({
        where: {
          commentId,
          userId,
        },
      });

      if (existingLike) {
        await tx.like.delete({
          where: {
            id: existingLike.id,
          },
        });
      } else {
        await tx.like.create({
          data: {
            commentId,
            userId,
          },
        });
      }
    });
  } catch (err) {
    console.log(err);
    throw new Error("Something went wrong");
  }
};

// Remplacer les lignes 315-350 par :
export const addComment = async (postId: number, desc: string) => {
  const { userId } = await auth();

  if (!userId) throw new Error("User is not authenticated!");

  try {
    const createdComment = await prisma.comment.create({
      data: {
        desc,
        userId,
        postId,
      },
      include: {
        user: true,
      },
    });

    // Récupérer les informations du post pour créer la notification
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        userId: true,
        desc: true,
      },
    });

    // Créer une notification pour le propriétaire du post
    if (post && post.userId !== userId) {
      console.log('Creating comment notification for user:', post.userId)

      const notificationResult = await createNotification({
        userId: post.userId,
        type: 'COMMENT',
        message: 'a commenté votre publication',
        triggeredById: userId,
        postId: postId,
        commentId: createdComment.id,
      });

      if (!notificationResult) {
        console.error('Failed to create comment notification')
      }
    }

    // Traiter les mentions dans le commentaire
    await processMentions(desc, userId, postId, createdComment.id);

    return createdComment;
  } catch (err) {
    console.error('Error in addComment:', err);
    throw new Error("Something went wrong!");
  }
};

// Nouvelle fonction pour ajouter une réponse à un commentaire
// Remplacer les lignes 375-400 par :
export const addReply = async (postId: number, parentId: number, desc: string) => {
  const { userId } = await auth();

  if (!userId) throw new Error("User is not authenticated!");

  try {
    const createdReply = await prisma.comment.create({
      data: {
        desc,
        userId,
        postId,
        parentId, // Lier à un commentaire parent
      },
      include: {
        user: true,
      },
    });

    // Récupérer le commentaire parent pour notifier son auteur
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { userId: true },
    });

    // Créer une notification pour l'auteur du commentaire parent
    if (parentComment && parentComment.userId !== userId) {
      console.log('Creating reply notification for user:', parentComment.userId)

      const notificationResult = await createNotification({
        userId: parentComment.userId,
        type: 'COMMENT',
        message: 'a répondu à votre commentaire',
        triggeredById: userId,
        postId: postId,
        commentId: createdReply.id,
      });

      if (!notificationResult) {
        console.error('Failed to create reply notification')
      }
    }

    // Traiter les mentions dans la réponse
    await processMentions(desc, userId, postId, createdReply.id);

    return createdReply;
  } catch (err) {
    console.log(err);
    throw new Error("Something went wrong!");
  }
};

export const deleteComment = async (commentId: number) => {
  const { userId } = await auth();

  if (!userId) throw new Error("User is not authenticated!");

  try {
    await prisma.comment.delete({
      where: {
        id: commentId,
        userId,
      },
    });
    revalidatePath("/");
  } catch (err) {
    console.log(err);
  }
};

// Remplacer les lignes 465-490 par :
export const addPost = async (formData: FormData, tempMediaUrl: string) => {
  const desc = formData.get("desc") as string;

  // Validation de la description
  const Desc = z.string().max(10000);
  const validatedDesc = Desc.safeParse(desc || "");

  if (!validatedDesc.success) {
    console.log("description is not valid");
    return;
  }

  // Vérifier qu'il y a au moins une description OU un média
  if (!validatedDesc.data.trim() && !tempMediaUrl) {
    console.log("Post must have either description or media");
    return;
  }

  const { userId } = await auth();
  if (!userId) throw new Error("User is not authenticated!");

  let finalMediaUrl = "";

  try {
    // Si il y a un média temporaire, le finaliser
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      console.log('🚀 Finalisation du média pour le post...');
      
      // Extraire le nom du fichier temporaire
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      
      // Finaliser l'upload directement
      const result = await finalizeUpload(tempFilename, 'posts');
      finalMediaUrl = result.final_url;
      console.log('✅ Média finalisé pour le post:', finalMediaUrl);
      
    } else {
      finalMediaUrl = tempMediaUrl;
    }

    // Créer le post avec l'URL finale
    const createdPost = await prisma.post.create({
      data: {
        desc: validatedDesc.data,
        userId,
        img: finalMediaUrl,
      },
    });

    // Traiter les mentions dans la publication
    if (validatedDesc.data.trim()) {
      await processMentions(validatedDesc.data, userId, createdPost.id);
    }

    revalidatePath("/");
    
    console.log('✅ Post créé avec succès');

  } catch (err) {
    console.error('❌ Erreur lors de la création du post:', err);
    
    // En cas d'erreur, nettoyer le fichier temporaire
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      await cleanupTempFile(tempFilename);
    }
    
    throw err;
  }
};

export const addStory = async (tempMediaUrl: string) => {
  const { userId } = await auth();
  if (!userId) throw new Error("User is not authenticated!");

  let finalMediaUrl = "";

  try {
    // Si il y a un média temporaire, le finaliser
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      console.log('🚀 Finalisation du média pour la story...');
      
      // Extraire le nom du fichier temporaire
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      
      // Finaliser l'upload directement
      const result = await finalizeUpload(tempFilename, 'stories');
      finalMediaUrl = result.final_url;
      console.log('✅ Média finalisé pour la story:', finalMediaUrl);
      
    } else {
      finalMediaUrl = tempMediaUrl;
    }

    // Création de la story avec une expiration de 24h
    const createdStory = await prisma.story.create({
      data: {
        userId,
        img: finalMediaUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 heures
      },
      include: {
        user: true, // Inclure les données de l'utilisateur pour l'UI
      },
    });

    // Invalider le cache pour que les nouvelles stories apparaissent immédiatement
    revalidatePath("/");

    console.log('✅ Story créée avec succès');
    return createdStory;
  } catch (err) {
    console.error("❌ Erreur lors de la création de la story:", err);
    
    // En cas d'erreur, nettoyer le fichier temporaire
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      await cleanupTempFile(tempFilename);
    }
    
    throw err;
  }
};

export const deleteStory = async (storyId: string) => {
  const { userId } = await auth();

  if (!userId) throw new Error("User is not authenticated!");

  try {
    // 1. Récupérer les informations de la story avant suppression
    const story = await prisma.story.findUnique({
      where: {
        id: storyId,
      },
      select: {
        userId: true,
        img: true, // Récupérer l'URL de l'image/vidéo
      }
    });

    if (!story) {
      throw new Error("Story not found");
    }

    if (story.userId !== userId) {
      throw new Error("You can only delete your own stories");
    }

    // 2. Supprimer la story de la base de données
    await prisma.story.delete({
      where: {
        id: storyId,
        userId, // Double sécurité
      },
    });

    // 3. Supprimer le fichier média associé (si il existe)
    if (story.img) {
      const deleted = await deleteMediaFile(story.img);
      if (deleted) {
        console.log(`✅ Fichier média supprimé avec la story ${storyId}`);
      }
    }

    // 4. Revalider le cache
    revalidatePath("/");

    console.log(`✅ Story ${storyId} supprimée avec succès`);
    
    return { success: true };
    
  } catch (err) {
    console.error("❌ Erreur lors de la suppression de la story:", err);
    throw err;
  }
};


export const deletePost = async (postId: number) => {
  const { userId } = await auth();

  if (!userId) throw new Error("User is not authenticated!");

  try {
    // 1. Récupérer les informations du post avant suppression
    const post = await prisma.post.findUnique({
      where: {
        id: postId,
        userId, // S'assurer que l'utilisateur peut supprimer ce post
      },
      select: {
        img: true, // Récupérer l'URL de l'image/vidéo
      }
    });

    if (!post) {
      throw new Error("Post not found or access denied");
    }

    // 2. Supprimer le post de la base de données
    await prisma.post.delete({
      where: {
        id: postId,
        userId,
      },
    });

    // 3. Supprimer le fichier média associé (si il existe)
    if (post.img) {
      const deleted = await deleteMediaFile(post.img);
      if (deleted) {
        console.log(`✅ Fichier média supprimé avec le post ${postId}`);
      }
    }

    // 4. Revalider le cache
    revalidatePath("/");
    
    console.log(`✅ Post ${postId} supprimé avec succès`);
    
  } catch (err) {
    console.error('❌ Erreur lors de la suppression du post:', err);
    throw err;
  }
};



// Fonction pour traiter les mentions dans un texte
const processMentions = async (text: string, triggeredById: string, postId: number, commentId?: number) => {
  // Extraire tous les @mentions du texte
  const mentionMatches = text.match(/@(\w+)/g);

  if (!mentionMatches) return;

  // Récupérer les usernames uniques
  const usernames = [...new Set(mentionMatches.map(match => match.slice(1)))];

  try {
    // Trouver les utilisateurs correspondants
    const mentionedUsers = await prisma.user.findMany({
      where: {
        username: {
          in: usernames,
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    // Créer des notifications pour chaque utilisateur mentionné
    for (const user of mentionedUsers) {
      // Ne pas notifier l'utilisateur s'il se mentionne lui-même
      if (user.id !== triggeredById) {
        console.log('Creating mention notification for user:', user.id)

        const notificationResult = await createNotification({
          userId: user.id,
          type: 'MENTION',
          message: commentId ? 'vous a mentionné dans un commentaire' : 'vous a mentionné dans une publication',
          triggeredById: triggeredById,
          postId: postId,
          commentId: commentId,
        });

        if (!notificationResult) {
          console.error('Failed to create mention notification for user:', user.id)
        }
      }
    }
  } catch (error) {
    console.error('Error processing mentions:', error);
  }
};

// Ajoutez cette fonction à votre action.ts existant pour corriger l'identification des messages

export const getConversationMessagesWithCurrentUser = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            surname: true,
            avatar: true
          }
        }
      }
    });

    return messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      senderId: msg.senderId === currentUserId ? 'currentUser' : msg.senderId,
      type: msg.type,
      mediaUrl: msg.mediaUrl
    }));
  } catch (err) {
    console.error('Error in getConversationMessagesWithCurrentUser:', err);
    throw new Error("Something went wrong");
  }
};

// Mise à jour de la fonction sendMessage pour retourner le bon senderId
export const sendMessageWithCurrentUser = async (conversationId: string, content: string, type: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT', mediaUrl?: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        content,
        type,
        mediaUrl,
        conversationId,
        senderId: currentUserId
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            surname: true,
            avatar: true
          }
        }
      }
    });

    // Mettre à jour la conversation avec la date du dernier message
    await prisma.conversation.update({
      where: {
        id: conversationId
      },
      data: {
        lastMessageAt: new Date()
      }
    });

    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      senderId: 'currentUser', // Toujours retourner 'currentUser' pour l'expéditeur
      type: message.type,
      mediaUrl: message.mediaUrl
    };
  } catch (err) {
    console.error('Error in sendMessageWithCurrentUser:', err);
    throw new Error("Something went wrong");
  }
};

// ========================================
// ACTIONS DE MESSAGERIE
// ========================================

export const getOrCreateConversation = async (otherUserId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Chercher une conversation existante entre les deux utilisateurs
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: {
              in: [currentUserId, otherUserId]
            }
          }
        },
        AND: [
          {
            participants: {
              some: {
                userId: currentUserId
              }
            }
          },
          {
            participants: {
              some: {
                userId: otherUserId
              }
            }
          }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Créer une nouvelle conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: currentUserId },
            { userId: otherUserId }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        messages: true
      }
    });

    return newConversation;
  } catch (err) {
    console.error('Error in getOrCreateConversation:', err);
    throw new Error("Something went wrong");
  }
};

export const getUserConversations = async () => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: currentUserId
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    // Transformer les données pour correspondre au format attendu par le composant
    // Transformer les données pour correspondre au format attendu par le composant
    return conversations.map(conv => {
      const otherUser = conv.participants.find((p: any) => p.userId !== currentUserId)?.user;
      const lastMessage = conv.messages[0];

      if (!otherUser) {
        throw new Error("Other user not found in conversation");
      }

      return {
        id: conv.id,
        lastMessage: lastMessage?.content || '',
        lastMessageAt: conv.lastMessageAt.toISOString(),
        unreadCount: 0,
        isOnline: false,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          name: otherUser.name ?? undefined,
          surname: otherUser.surname ?? undefined,
          avatar: otherUser.avatar ?? undefined
        }
      };
    });

  } catch (err) {
    console.error('Error in getUserConversations:', err);
    throw new Error("Something went wrong");
  }
};


// Dans votre fichier action.ts, remplacez la fonction getConversationMessages existante par celle-ci :

export const getConversationMessages = async (
  conversationId: string, 
  offset: number = 0, 
  limit: number = 20
) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    console.log(`Fetching messages for conversation ${conversationId} with offset: ${offset}, limit: ${limit}`);

    // Pour le chargement initial (offset = 0), on veut les derniers messages
    if (offset === 0) {
      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversationId
        },
        orderBy: {
          createdAt: 'asc' // Ordre chronologique pour affichage
        },
        take: -limit, // Prendre les derniers messages (les plus récents)
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
              surname: true,
              avatar: true
            }
          }
        }
      });

      console.log(`Retrieved latest ${messages.length} messages for initial load`);

      return messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        senderId: msg.senderId,
        type: msg.type,
        mediaUrl: msg.mediaUrl
      }));
    } else {
      // Pour le scroll infini : récupérer les messages plus anciens
      // Compter le nombre total de messages pour calculer le bon offset
      const totalMessages = await prisma.message.count({
        where: {
          conversationId: conversationId
        }
      });

      console.log(`Total messages in conversation: ${totalMessages}, requesting offset: ${offset}`);

      // Si l'offset est >= total, il n'y a plus de messages
      if (offset >= totalMessages) {
        console.log('No more messages to load');
        return [];
      }

      // Calculer l'offset réel pour récupérer les messages plus anciens
      // offset représente combien de messages on a déjà (en partant des plus récents)
      const realOffset = Math.max(0, totalMessages - offset - limit);
      const realLimit = Math.min(limit, totalMessages - offset);

      console.log(`Calculated real offset: ${realOffset}, real limit: ${realLimit}`);

      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversationId
        },
        orderBy: {
          createdAt: 'asc' // Ordre chronologique
        },
        skip: realOffset,
        take: realLimit,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
              surname: true,
              avatar: true
            }
          }
        }
      });

      console.log(`Retrieved ${messages.length} older messages`);

      return messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        senderId: msg.senderId,
        type: msg.type,
        mediaUrl: msg.mediaUrl
      }));
    }
  } catch (err) {
    console.error('Error in getConversationMessages:', err);
    throw new Error("Something went wrong");
  }
};

// Si vous voulez une version alternative qui récupère les derniers messages par défaut
export const getLatestConversationMessages = async (
  conversationId: string,
  limit: number = 20
) => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: userId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    // Pour le chargement initial, on veut les derniers messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId
      },
      orderBy: {
        createdAt: 'asc' // Ordre chronologique pour affichage
      },
      take: -limit // Prendre les derniers messages
    });

    console.log(`Retrieved latest ${messages.length} messages for conversation ${conversationId}`);

    return messages;
  } catch (error) {
    console.error("Error in getLatestConversationMessages:", error);
    throw error;
  }
};

// Dans votre fichier action.ts, remplacez la fonction sendMessage existante par celle-ci :

export const sendMessage = async (
  conversationId: string,
  content: string,
  type: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT',
  mediaUrl?: string
) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    console.log(`Sending message to conversation ${conversationId} from user ${currentUserId}`);

    // Créer le message
    const message = await prisma.message.create({
      data: {
        content,
        type,
        mediaUrl,
        conversationId,
        senderId: currentUserId
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            surname: true,
            avatar: true
          }
        }
      }
    });

    // Mettre à jour la conversation avec la date du dernier message
    await prisma.conversation.update({
      where: {
        id: conversationId
      },
      data: {
        lastMessageAt: new Date()
      }
    });

    console.log(`Message sent successfully: ${message.id}`);

    // Retourner le message avec le bon format
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(), // Convertir Date en string
      senderId: message.senderId,
      type: message.type,
      mediaUrl: message.mediaUrl
    };
  } catch (err) {
    console.error('Error in sendMessage:', err);
    throw new Error("Something went wrong");
  }
};

export const markConversationAsRead = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: currentUserId
      },
      data: {
        lastReadAt: new Date()
      }
    });
  } catch (err) {
    console.error('Error in markConversationAsRead:', err);
    throw new Error("Something went wrong");
  }
};

// Ajouter cette nouvelle fonction dans action.ts

// Ajouter cette fonction dans votre action.ts

// Remplacer la fonction createConversationWithFirstMessage dans action.ts

export const createConversationWithFirstMessage = async (otherUserId: string, firstMessage: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  console.log("Creating conversation between", currentUserId, "and", otherUserId, "with message:", firstMessage);

  try {
    // Vérifier d'abord si une conversation existe déjà
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: {
              in: [currentUserId, otherUserId]
            }
          }
        },
        AND: [
          {
            participants: {
              some: {
                userId: currentUserId
              }
            }
          },
          {
            participants: {
              some: {
                userId: otherUserId
              }
            }
          }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    let conversation;

    if (existingConversation) {
      console.log("Found existing conversation:", existingConversation.id);
      
      // 🔧 CORRECTION : Vérifier si l'utilisateur actuel a supprimé cette conversation
      const deletedByCurrentUser = await prisma.deletedConversation.findUnique({
        where: {
          userId_conversationId: {
            userId: currentUserId,
            conversationId: existingConversation.id
          }
        }
      });

      // 🔧 Si l'utilisateur avait supprimé la conversation, la restaurer
      if (deletedByCurrentUser) {
        console.log("Restoring conversation for current user:", currentUserId);
        
        await prisma.deletedConversation.delete({
          where: {
            userId_conversationId: {
              userId: currentUserId,
              conversationId: existingConversation.id
            }
          }
        });
        
        console.log("Conversation restored successfully");
      }
      
      conversation = existingConversation;
    } else {
      console.log("Creating new conversation");
      // Créer une nouvelle conversation
      conversation = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: currentUserId },
              { userId: otherUserId }
            ]
          },
          lastMessageAt: new Date() // Initialiser avec la date actuelle
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  surname: true,
                  avatar: true
                }
              }
            }
          }
        }
      });
      console.log("New conversation created:", conversation.id);
    }

    // Créer le premier message
    console.log("Creating first message in conversation:", conversation.id);
    const message = await prisma.message.create({
      data: {
        content: firstMessage,
        type: 'TEXT',
        conversationId: conversation.id,
        senderId: currentUserId
      }
    });
    console.log("Message created:", message);

    // Mettre à jour la conversation avec la date du dernier message
    await prisma.conversation.update({
      where: {
        id: conversation.id
      },
      data: {
        lastMessageAt: new Date()
      }
    });

    return {
      id: conversation.id,
      participants: conversation.participants,
      message: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        senderId: message.senderId,
        type: message.type
      }
    };
  } catch (err) {
    console.error('Error in createConversationWithFirstMessage:', err);
    throw new Error("Something went wrong");
  }
};

// 🔧 CORRECTION : Fonction utilitaire pour restaurer une conversation (version améliorée)
export const restoreConversationForUser = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    console.log(`Restoring conversation ${conversationId} for user ${currentUserId}`);

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation no longer exists");
    }

    // Vérifier si la conversation était effectivement supprimée
    const deletedRecord = await prisma.deletedConversation.findUnique({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: conversationId
        }
      }
    });

    if (!deletedRecord) {
      console.log(`Conversation ${conversationId} was not deleted for user ${currentUserId}`);
      return { success: true, restored: false, wasDeleted: false };
    }

    // Supprimer l'entrée de suppression pour cet utilisateur
    await prisma.deletedConversation.delete({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: conversationId
        }
      }
    });

    console.log(`Successfully restored conversation ${conversationId} for user ${currentUserId}`);
    
    return { 
      success: true, 
      restored: true, 
      wasDeleted: true,
      deletedAt: deletedRecord.deletedAt 
    };
  } catch (err) {
    console.error('Error in restoreConversationForUser:', err);
    throw new Error("Something went wrong");
  }
};

export const checkConversationAccess = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      return { hasAccess: false, conversation: null, wasDeleted: false };
    }

    // Vérifier si l'utilisateur a supprimé cette conversation
    const deletedConversation = await prisma.deletedConversation.findUnique({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: conversationId
        }
      }
    });

    if (deletedConversation) {
      console.log(`User ${currentUserId} tried to access deleted conversation ${conversationId}`);
      return { 
        hasAccess: false, 
        conversation, 
        wasDeleted: true,
        deletedAt: deletedConversation.deletedAt 
      };
    }

    return { hasAccess: true, conversation, wasDeleted: false };
  } catch (err) {
    console.error('Error in checkConversationAccess:', err);
    throw new Error("Something went wrong");
  }
};

// Fonction pour restaurer et rediriger vers une conversation
export const restoreAndAccessConversation = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier d'abord l'accès
    const accessCheck = await checkConversationAccess(conversationId);
    
    if (!accessCheck.conversation) {
      throw new Error("Conversation not found");
    }

    if (accessCheck.wasDeleted) {
      // Restaurer la conversation
      await prisma.deletedConversation.delete({
        where: {
          userId_conversationId: {
            userId: currentUserId,
            conversationId: conversationId
          }
        }
      });

      console.log(`Conversation ${conversationId} restored for user ${currentUserId}`);
    }

    return { success: true, conversation: accessCheck.conversation };
  } catch (err) {
    console.error('Error in restoreAndAccessConversation:', err);
    throw new Error("Something went wrong");
  }
};

// Modifier également la fonction getOrCreateConversation pour qu'elle ne crée la conversation que si demandé explicitement
export const getOrCreateConversationModified = async (otherUserId: string, createIfNotExists: boolean = false) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Chercher une conversation existante entre les deux utilisateurs
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: {
              in: [currentUserId, otherUserId]
            }
          }
        },
        AND: [
          {
            participants: {
              some: {
                userId: currentUserId
              }
            }
          },
          {
            participants: {
              some: {
                userId: otherUserId
              }
            }
          }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Ne créer une nouvelle conversation que si explicitement demandé
    if (!createIfNotExists) {
      return null;
    }

    // Créer une nouvelle conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: currentUserId },
            { userId: otherUserId }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        messages: true
      }
    });

    return newConversation;
  } catch (err) {
    console.error('Error in getOrCreateConversationModified:', err);
    throw new Error("Something went wrong");
  }
};

export const deleteMessageEnhanced = async (messageId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que le message appartient à l'utilisateur
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { 
        senderId: true, 
        conversationId: true 
      }
    });

    if (!message) {
      throw new Error("Message not found");
    }

    if (message.senderId !== currentUserId) {
      throw new Error("You can only delete your own messages");
    }

    const conversationId = message.conversationId;

    // Supprimer le message
    await prisma.message.delete({
      where: { id: messageId }
    });

    console.log(`Message ${messageId} deleted by user ${currentUserId}`);

    // Vérifier si la conversation est maintenant vide
    const cleanupResult = await checkAndCleanupEmptyConversation(conversationId);

    return { 
      success: true,
      conversationDeleted: cleanupResult.deleted,
      reason: cleanupResult.reason
    };
  } catch (err) {
    console.error('Error in deleteMessageEnhanced:', err);
    throw new Error("Something went wrong");
  }
};

export const deleteConversationForUser = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    console.log(`\n=== DEBUG deleteConversationForUser ===`);
    console.log(`User: ${currentUserId}, Conversation: ${conversationId}`);

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      console.error(`❌ Conversation ${conversationId} non trouvée pour user ${currentUserId}`);
      throw new Error("Conversation not found or access denied");
    }

    console.log(`✅ Conversation trouvée: ${conversation.id}`);

    // Vérifier si déjà supprimée
    const existingDeletion = await prisma.deletedConversation.findUnique({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: conversationId
        }
      }
    });

    if (existingDeletion) {
      console.log(`⚠️ Conversation déjà supprimée le: ${existingDeletion.deletedAt}`);
      return { 
        success: true, 
        alreadyDeleted: true,
        conversationDeleted: false,
        reason: 'Already deleted'
      };
    }

    // Créer l'entrée de suppression avec gestion d'erreur
    console.log(`📝 Création de l'entrée de suppression...`);
    
    const deletionRecord = await prisma.deletedConversation.upsert({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: conversationId
        }
      },
      update: {
        deletedAt: new Date()
      },
      create: {
        userId: currentUserId,
        conversationId: conversationId,
        deletedAt: new Date()
      }
    });

    console.log(`✅ Suppression enregistrée:`, {
      id: deletionRecord.id,
      userId: deletionRecord.userId,
      conversationId: deletionRecord.conversationId,
      deletedAt: deletionRecord.deletedAt
    });

    // Vérifier si tous les participants ont supprimé
    console.log(`🔍 Vérification pour suppression définitive...`);
    
    const totalParticipants = await prisma.conversationParticipant.count({
      where: { conversationId: conversationId }
    });

    const deletedByCount = await prisma.deletedConversation.count({
      where: { conversationId: conversationId }
    });

    console.log(`📊 Participants total: ${totalParticipants}, Supprimé par: ${deletedByCount}`);

    let conversationDeleted = false;
    let reason = '';

    if (deletedByCount >= totalParticipants && totalParticipants > 0) {
      console.log(`🗑️ Suppression définitive de la conversation ${conversationId}`);
      
      try {
        await prisma.conversation.delete({
          where: { id: conversationId }
        });
        
        conversationDeleted = true;
        reason = 'All participants deleted the conversation';
        console.log(`✅ Conversation supprimée définitivement`);
      } catch (deleteError) {
        console.error(`❌ Erreur lors de la suppression définitive:`, deleteError);
        // Ne pas faire échouer l'opération si la suppression définitive échoue
      }
    }

    console.log(`=== FIN DEBUG deleteConversationForUser ===\n`);

    return { 
      success: true, 
      conversationDeleted,
      reason,
      deletedByCount,
      totalParticipants
    };

  } catch (err) {
    console.error('❌ ERREUR COMPLETE dans deleteConversationForUser:', err);
    
    // Log détaillé de l'erreur
    if (err instanceof Error) {
      console.error('Message:', err.message);
      console.error('Stack:', err.stack);
    } else {
      console.error('Erreur non-Error:', err);
    }
    
    // Re-throw avec plus de détails
    throw new Error(`Erreur suppression conversation: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

export const getUserConversationsUpdated = async () => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    console.log(`\n=== getUserConversationsUpdated pour ${currentUserId} ===`);

    // Récupérer les IDs des conversations supprimées par cet utilisateur
    const deletedConversationIds = await prisma.deletedConversation.findMany({
      where: {
        userId: currentUserId
      },
      select: {
        conversationId: true
      }
    });

    const deletedIds = deletedConversationIds.map(d => d.conversationId);
    console.log(`🚫 Conversations supprimées: [${deletedIds.join(', ')}]`);

    // Récupérer toutes les conversations SAUF celles supprimées
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: currentUserId
          }
        },
        // Exclusion explicite par ID
        id: {
          notIn: deletedIds
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    console.log(`✅ Conversations récupérées: [${conversations.map(c => c.id).join(', ')}]`);
    console.log(`=== FIN getUserConversationsUpdated ===\n`);

    return conversations.map(conv => {
      const otherUser = conv.participants.find((p: any) => p.userId !== currentUserId)?.user;
      const lastMessage = conv.messages[0];

      if (!otherUser) {
        throw new Error("Other user not found in conversation");
      }

      return {
        id: conv.id,
        lastMessage: lastMessage?.content || '',
        lastMessageAt: conv.lastMessageAt.toISOString(),
        unreadCount: 0,
        isOnline: false,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          name: otherUser.name ?? undefined,
          surname: otherUser.surname ?? undefined,
          avatar: otherUser.avatar ?? undefined
        }
      };
    });

  } catch (err) {
    console.error('❌ ERREUR dans getUserConversationsUpdated:', err);
    throw err;
  }
};

// Fonction pour restaurer une conversation (version améliorée)
export const restoreConversationForUserEnhanced = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier d'abord si la conversation existe encore
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      throw new Error("Conversation no longer exists");
    }

    // Supprimer l'entrée de suppression pour cet utilisateur
    await prisma.deletedConversation.deleteMany({
      where: {
        userId: currentUserId,
        conversationId: conversationId
      }
    });

    console.log(`Conversation ${conversationId} restored for user ${currentUserId}`);
    return { success: true };
  } catch (err) {
    console.error('Error in restoreConversationForUserEnhanced:', err);
    throw new Error("Something went wrong");
  }
};

// Fonction utilitaire pour vérifier et nettoyer les conversations
const checkAndCleanupConversation = async (conversationId: string) => {
  try {
    // Compter le nombre total de participants
    const totalParticipants = await prisma.conversationParticipant.count({
      where: {
        conversationId: conversationId
      }
    });

    // Compter le nombre d'utilisateurs qui ont supprimé la conversation
    const deletedByCount = await prisma.deletedConversation.count({
      where: {
        conversationId: conversationId
      }
    });

    console.log(`Conversation ${conversationId}: ${deletedByCount}/${totalParticipants} users deleted it`);

    // Si tous les participants ont supprimé la conversation, la supprimer définitivement
    if (deletedByCount >= totalParticipants && totalParticipants > 0) {
      console.log(`All participants deleted conversation ${conversationId}, removing from database`);
      
      // Supprimer en cascade : messages, participants, suppressions
      await prisma.conversation.delete({
        where: { id: conversationId }
      });
      
      return { deleted: true, reason: 'All participants deleted the conversation' };
    }

    return { deleted: false };
  } catch (err) {
    console.error('Error in checkAndCleanupConversation:', err);
    return { deleted: false };
  }
};

// Fonction utilitaire pour vérifier si une conversation est vide
const checkAndCleanupEmptyConversation = async (conversationId: string) => {
  try {
    // Compter le nombre de messages dans la conversation
    const messageCount = await prisma.message.count({
      where: {
        conversationId: conversationId
      }
    });

    console.log(`Conversation ${conversationId} has ${messageCount} messages`);

    // Si la conversation n'a aucun message, la supprimer
    if (messageCount === 0) {
      console.log(`Conversation ${conversationId} is empty, removing from database`);
      
      await prisma.conversation.delete({
        where: { id: conversationId }
      });
      
      return { deleted: true, reason: 'Conversation is empty' };
    }

    return { deleted: false };
  } catch (err) {
    console.error('Error in checkAndCleanupEmptyConversation:', err);
    return { deleted: false };
  }
};

// Fonction pour nettoyer toutes les conversations orphelines (optionnel, pour maintenance)
export const cleanupOrphanedConversations = async () => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Cette fonction peut être utilisée pour nettoyer périodiquement
    // Récupérer toutes les conversations
    const conversations = await prisma.conversation.findMany({
      include: {
        participants: true,
        deletedConversations: true,
        messages: true
      }
    });

    let cleanedCount = 0;

    for (const conv of conversations) {
      const totalParticipants = conv.participants.length;
      const deletedByCount = conv.deletedConversations.length;
      const messageCount = conv.messages.length;

      // Supprimer si tous les participants ont supprimé OU si aucun message
      if ((deletedByCount >= totalParticipants && totalParticipants > 0) || messageCount === 0) {
        await prisma.conversation.delete({
          where: { id: conv.id }
        });
        cleanedCount++;
        console.log(`Cleaned up conversation ${conv.id}`);
      }
    }

    return { success: true, cleanedCount };
  } catch (err) {
    console.error('Error in cleanupOrphanedConversations:', err);
    throw new Error("Something went wrong");
  }
};

// Ajouter ces fonctions à votre action.ts existant

// Fonction d'envoi de message avec upload améliorée
export const sendMessageWithMedia = async (
  conversationId: string,
  content: string,
  tempMediaUrl?: string,
  type: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT'
) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    console.log(`Sending message to conversation ${conversationId} from user ${currentUserId}`);

    let finalMediaUrl = "";

    // Si il y a un média temporaire, le finaliser
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      console.log('🚀 Finalisation du média pour le message...');
      
      // Extraire le nom du fichier temporaire
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      
      // Finaliser l'upload
      const result = await finalizeUpload(tempFilename, 'messages');
      finalMediaUrl = result.final_url;
      console.log('✅ Média finalisé pour le message:', finalMediaUrl);
      
    } else if (tempMediaUrl) {
      finalMediaUrl = tempMediaUrl;
    }

    // Déterminer le type automatiquement si un média est présent
    let messageType = type;
    if (finalMediaUrl) {
      const isVideo = finalMediaUrl.match(/\.(mp4|webm|ogg|mov|avi|wmv|flv|m4v|3gp|mkv)(\?.*)?$/i);
      messageType = isVideo ? 'VIDEO' : 'IMAGE';
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        content: content || '', // Permettre un contenu vide si média présent
        type: messageType,
        mediaUrl: finalMediaUrl || null,
        conversationId,
        senderId: currentUserId
      }
    });

    // Mettre à jour la conversation avec la date du dernier message
    await prisma.conversation.update({
      where: {
        id: conversationId
      },
      data: {
        lastMessageAt: new Date()
      }
    });

    console.log(`Message sent successfully: ${message.id}`);

    // Retourner le message avec le bon format
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      senderId: message.senderId,
      type: message.type,
      mediaUrl: message.mediaUrl
    };
  } catch (err) {
    console.error('Error in sendMessageWithMedia:', err);
    
    // En cas d'erreur, nettoyer le fichier temporaire
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      await cleanupTempFile(tempFilename);
    }
    
    throw new Error("Something went wrong");
  }
};

// Fonction améliorée pour supprimer un message avec nettoyage du média
export const deleteMessageWithMedia = async (messageId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Récupérer le message avec ses informations média
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { 
        senderId: true, 
        conversationId: true,
        mediaUrl: true // Important pour supprimer le fichier
      }
    });

    if (!message) {
      throw new Error("Message not found");
    }

    if (message.senderId !== currentUserId) {
      throw new Error("You can only delete your own messages");
    }

    const conversationId = message.conversationId;

    // Supprimer le fichier média associé AVANT de supprimer le message de la DB
    if (message.mediaUrl) {
      const deleted = await deleteMediaFile(message.mediaUrl);
      if (deleted) {
        console.log(`✅ Fichier média supprimé avec le message ${messageId}`);
      }
    }

    // Supprimer le message de la base de données
    await prisma.message.delete({
      where: { id: messageId }
    });

    console.log(`Message ${messageId} deleted by user ${currentUserId}`);

    // Vérifier si la conversation est maintenant vide
    const cleanupResult = await checkAndCleanupEmptyConversation(conversationId);

    return { 
      success: true,
      conversationDeleted: cleanupResult.deleted,
      reason: cleanupResult.reason
    };
  } catch (err) {
    console.error('Error in deleteMessageWithMedia:', err);
    throw new Error("Something went wrong");
  }
};

// Fonction pour créer une conversation avec premier message et média
export const createConversationWithMediaMessage = async (
  otherUserId: string, 
  content: string, 
  tempMediaUrl?: string
) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  console.log("Creating conversation with media between", currentUserId, "and", otherUserId);

  try {
    // Vérifier d'abord si une conversation existe déjà
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: {
              in: [currentUserId, otherUserId]
            }
          }
        },
        AND: [
          {
            participants: {
              some: {
                userId: currentUserId
              }
            }
          },
          {
            participants: {
              some: {
                userId: otherUserId
              }
            }
          }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    let conversation;

    if (existingConversation) {
      console.log("Found existing conversation:", existingConversation.id);
      
      // Vérifier si l'utilisateur actuel a supprimé cette conversation
      const deletedByCurrentUser = await prisma.deletedConversation.findUnique({
        where: {
          userId_conversationId: {
            userId: currentUserId,
            conversationId: existingConversation.id
          }
        }
      });

      // Si l'utilisateur avait supprimé la conversation, la restaurer
      if (deletedByCurrentUser) {
        console.log("Restoring conversation for current user:", currentUserId);
        
        await prisma.deletedConversation.delete({
          where: {
            userId_conversationId: {
              userId: currentUserId,
              conversationId: existingConversation.id
            }
          }
        });
        
        console.log("Conversation restored successfully");
      }
      
      conversation = existingConversation;
    } else {
      console.log("Creating new conversation");
      // Créer une nouvelle conversation
      conversation = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: currentUserId },
              { userId: otherUserId }
            ]
          },
          lastMessageAt: new Date()
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  surname: true,
                  avatar: true
                }
              }
            }
          }
        }
      });
      console.log("New conversation created:", conversation.id);
    }

    let finalMediaUrl = "";

    // Traiter le média si présent
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      console.log('🚀 Finalisation du média pour le premier message...');
      
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      const result = await finalizeUpload(tempFilename, 'messages');
      finalMediaUrl = result.final_url;
      console.log('✅ Média finalisé:', finalMediaUrl);
      
    } else if (tempMediaUrl) {
      finalMediaUrl = tempMediaUrl;
    }

    // Déterminer le type de message
    let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT';
    if (finalMediaUrl) {
      const isVideo = finalMediaUrl.match(/\.(mp4|webm|ogg|mov|avi|wmv|flv|m4v|3gp|mkv)(\?.*)?$/i);
      messageType = isVideo ? 'VIDEO' : 'IMAGE';
    }

    // Créer le premier message
    console.log("Creating first message in conversation:", conversation.id);
    const message = await prisma.message.create({
      data: {
        content: content || '',
        type: messageType,
        mediaUrl: finalMediaUrl || null,
        conversationId: conversation.id,
        senderId: currentUserId
      }
    });
    console.log("Message created:", message);

    // Mettre à jour la conversation avec la date du dernier message
    await prisma.conversation.update({
      where: {
        id: conversation.id
      },
      data: {
        lastMessageAt: new Date()
      }
    });

    return {
      id: conversation.id,
      participants: conversation.participants,
      message: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        senderId: message.senderId,
        type: message.type,
        mediaUrl: message.mediaUrl
      }
    };
  } catch (err) {
    console.error('Error in createConversationWithMediaMessage:', err);
    
    // En cas d'erreur, nettoyer le fichier temporaire
    if (tempMediaUrl && tempMediaUrl.includes('/temp/')) {
      const tempFilename = tempMediaUrl.split('/temp/')[1];
      await cleanupTempFile(tempFilename);
    }
    
    throw new Error("Something went wrong");
  }
};
// ========================================
// FONCTIONS POUR LE SYSTÈME DE LECTURE DES MESSAGES
// Ajoutez ces fonctions à la fin de votre action.ts
// ========================================

export const markMessageAsRead = async (messageId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que le message existe et que l'utilisateur a accès à la conversation
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: {
          participants: {
            some: {
              userId: currentUserId
            }
          }
        }
      }
    });

    if (!message) {
      throw new Error("Message not found or access denied");
    }

    // Ne pas marquer ses propres messages comme lus
    if (message.senderId === currentUserId) {
      return { success: true, skipped: true };
    }

    // Créer ou mettre à jour le statut de lecture
    await prisma.messageRead.upsert({
      where: {
        messageId_userId: {
          messageId: messageId,
          userId: currentUserId
        }
      },
      update: {
        readAt: new Date()
      },
      create: {
        messageId: messageId,
        userId: currentUserId,
        readAt: new Date()
      }
    });

    console.log(`Message ${messageId} marked as read by user ${currentUserId}`);
    return { success: true };
  } catch (err) {
    console.error('Error in markMessageAsRead:', err);
    throw new Error("Something went wrong");
  }
};

export const markConversationAsReadEnhanced = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier l'accès à la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    // Récupérer tous les messages non lus de cette conversation (sauf ses propres messages)
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        senderId: {
          not: currentUserId // Seulement les messages des autres
        },
        NOT: {
          reads: {
            some: {
              userId: currentUserId
            }
          }
        }
      },
      select: {
        id: true
      }
    });

    console.log(`Found ${unreadMessages.length} unread messages in conversation ${conversationId}`);

    // Marquer tous ces messages comme lus
    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map(msg => ({
          messageId: msg.id,
          userId: currentUserId,
          readAt: new Date()
        })),
        skipDuplicates: true
      });

      console.log(`Marked ${unreadMessages.length} messages as read in conversation ${conversationId}`);
    }

    // Aussi mettre à jour le lastReadAt du participant
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: conversationId,
        userId: currentUserId
      },
      data: {
        lastReadAt: new Date()
      }
    });

    return { success: true, markedCount: unreadMessages.length };
  } catch (err) {
    console.error('Error in markConversationAsReadEnhanced:', err);
    throw new Error("Something went wrong");
  }
};

export const getUnreadMessageIds = async (conversationId: string) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Récupérer les messages non lus
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        senderId: {
          not: currentUserId
        },
        NOT: {
          reads: {
            some: {
              userId: currentUserId
            }
          }
        }
      },
      select: {
        id: true
      }
    });

    const unreadIds = unreadMessages.map(msg => msg.id);
    console.log(`Found ${unreadIds.length} unread messages in conversation ${conversationId}`);

    return {
      unreadMessageIds: unreadIds,
      count: unreadIds.length
    };
  } catch (err) {
    console.error('Error in getUnreadMessageIds:', err);
    throw new Error("Something went wrong");
  }
};

export const getUnreadCounts = async () => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Récupérer toutes les conversations de l'utilisateur (non supprimées)
    const deletedConversationIds = await prisma.deletedConversation.findMany({
      where: {
        userId: currentUserId
      },
      select: {
        conversationId: true
      }
    });

    const deletedIds = deletedConversationIds.map(d => d.conversationId);

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: currentUserId
          }
        },
        id: {
          notIn: deletedIds
        }
      },
      select: {
        id: true,
        messages: {
          where: {
            senderId: {
              not: currentUserId
            },
            NOT: {
              reads: {
                some: {
                  userId: currentUserId
                }
              }
            }
          },
          select: {
            id: true
          }
        }
      }
    });

    // Construire l'objet des compteurs
    const unreadCounts: Record<string, number> = {};
    conversations.forEach(conv => {
      unreadCounts[conv.id] = conv.messages.length;
    });

    console.log(`Unread counts computed:`, unreadCounts);
    return unreadCounts;
  } catch (err) {
    console.error('Error in getUnreadCounts:', err);
    throw new Error("Something went wrong");
  }
};

// Modifier la fonction sendMessage existante pour ne PAS créer automatiquement MessageRead
// Le message ne sera marqué comme lu que quand l'utilisateur le voit vraiment

export const sendMessageEnhanced = async (
  conversationId: string,
  content: string,
  type: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT',
  mediaUrl?: string
) => {
  const { userId: currentUserId } = auth();

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: currentUserId
          }
        }
      }
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    console.log(`Sending message to conversation ${conversationId} from user ${currentUserId}`);

    // Créer le message (SANS créer automatiquement MessageRead)
    const message = await prisma.message.create({
      data: {
        content,
        type,
        mediaUrl,
        conversationId,
        senderId: currentUserId
      }
    });

    // Mettre à jour la conversation avec la date du dernier message
    await prisma.conversation.update({
      where: {
        id: conversationId
      },
      data: {
        lastMessageAt: new Date()
      }
    });

    console.log(`Message sent successfully: ${message.id}`);

    // Retourner le message avec le bon format
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      senderId: message.senderId,
      type: message.type,
      mediaUrl: message.mediaUrl
    };
  } catch (err) {
    console.error('Error in sendMessageEnhanced:', err);
    throw new Error("Something went wrong");
  }
};