import prisma from "./client";

interface CreateNotificationParams {
  userId: string;
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'FOLLOW_REQUEST' | 'MENTION';
  message: string;
  triggeredById: string;
  postId?: number;
  commentId?: number;
}

export const createNotification = async (params: CreateNotificationParams) => {
  const { userId, type, message, triggeredById, postId, commentId } = params;

  try {
    // Vérifier si une notification similaire existe déjà (pour éviter les doublons)
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId,
        type,
        triggeredById,
        postId: postId || null,
        commentId: commentId || null,
        // Vérifier seulement les notifications récentes (dernières 24h)
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
    });

    // Si une notification similaire existe déjà, ne pas en créer une nouvelle
    if (existingNotification) {
      console.log('Similar notification already exists, skipping...');
      return existingNotification;
    }

    // Créer la nouvelle notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        triggeredById,
        postId: postId || undefined,
        commentId: commentId || undefined,
      },
      include: {
        triggeredBy: {
          select: {
            username: true,
            avatar: true,
            name: true,
            surname: true,
          },
        },
        post: postId ? {
          select: {
            id: true,
            desc: true,
            img: true,
          },
        } : undefined,
        comment: commentId ? {
          select: {
            id: true,
            desc: true,
          },
        } : undefined,
      },
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  try {
    await prisma.notification.update({
      where: {
        id: notificationId,
        userId, // S'assurer que l'utilisateur peut seulement marquer ses propres notifications
      },
      data: {
        read: true,
      },
    });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

export const getNotifications = async (userId: string, limit: number = 20) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
      },
      include: {
        triggeredBy: {
          select: {
            username: true,
            avatar: true,
            name: true,
            surname: true,
          },
        },
        post: {
          select: {
            id: true,
            desc: true,
            img: true,
          },
        },
        comment: {
          select: {
            id: true,
            desc: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const getUnreadNotificationCount = async (userId: string) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
    return count;
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }
};

export const deleteNotification = async (notificationId: string, userId: string) => {
  try {
    await prisma.notification.delete({
      where: {
        id: notificationId,
        userId, // S'assurer que l'utilisateur peut seulement supprimer ses propres notifications
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};