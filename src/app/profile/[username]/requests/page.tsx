// src/app/profile/[username]/requests/page.tsx
import prisma from '@/lib/client'
import { notFound } from 'next/navigation'
import { auth } from "@clerk/nextjs/server"
import RequestsPageClient from './RequestsPageClient'
import RightMenu from '@/app/components/rightMenu/RightMenu'
import LefttMenu from '@/app/components/leftMenu/LeftMenu'

type Props = {
    params: { username: string }
}

export default async function RequestsPage({ params }: Props) {
    const { userId } = await auth()

    if (!userId) return notFound()

    const user = await prisma.user.findUnique({
        where: { username: params.username },
        select: { id: true, username: true, avatar: true },
    })

    if (!user) return notFound()

    // Vérifier que l'utilisateur connecté peut voir les demandes d'amis
    if (user.id !== userId) {
        return notFound() // Ou rediriger vers une page d'erreur
    }

    // Récupérer toutes les demandes d'amis reçues
    const requests = await prisma.followRequest.findMany({
        where: {
            receiverId: userId
        },
        include: {
            sender: true,
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    return (
        <>
            <div className="flex gap-8 pt-6">
                <div className="hidden xl:block w-[20%]">
                    <LefttMenu type={'home'} />
                </div>
                <div className="w-full lg:w-[70%] xl:w-[50%]">
                    <RequestsPageClient user={user} initialRequests={requests} />
                </div>
                <div className="hidden lg:block w-[30%]">
                    <RightMenu />
                </div>
            </div>
        </>
    )

}