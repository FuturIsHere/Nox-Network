// app/notifications/page.tsx
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/client"
import NotificationsList from "../components/notifications/NotificationList"
import RightMenu from "../components/rightMenu/RightMenu"
import { formatPostDate } from "@/utils/formatPostDate"
import LeftMenu from "../components/leftMenu/LeftMenu"
import { Bell } from "lucide-react"

const NotificationsPage = async () => {
  const { userId } = await auth()
  
  if (!userId) {
    redirect("/sign-in")
  }

  // Récupérer l'utilisateur connecté pour le RightMenu
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      _count: {
        select: {
          followers: true,
          followings: true,
          posts: true,
        },
      },
    },
  })

  if (!user) {
    redirect("/sign-in")
  }

  // Récupérer toutes les notifications de l'utilisateur
  const notifications = await prisma.notification.findMany({
    where: {
      userId: userId,
    },
    include: {
      triggeredBy: {
        select: {
          id: true,
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
  })

  // Marquer toutes les notifications comme lues
  await prisma.notification.updateMany({
    where: {
      userId: userId,
      read: false,
    },
    data: {
      read: true,
    },
  })

  // Formater les notifications avec la date
  const formattedNotifications = notifications.map(notif => ({
    ...notif,
    formattedDate: formatPostDate(new Date(notif.createdAt)),
  }))

  return (
    <div className="flex gap-8 pt-6">
       <div className="hidden xl:block w-[20%]"><LeftMenu type="home" /></div>
      <div className="w-full lg:w-[70%] xl:w-[50%]">
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-[30px] shadow-md p-6">
            <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-800">
              Notifications
            </h1>
            </div>
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg mb-2">🔔</div>
                <p className="text-gray-500">No notifications at the moment.</p>
              </div>
            ) : (
              <NotificationsList notifications={formattedNotifications} />
            )}
          </div>
        </div>
      </div>
      <div className="hidden lg:block w-[30%]">
        <RightMenu />
      </div>
    </div>
  )
}

export default NotificationsPage