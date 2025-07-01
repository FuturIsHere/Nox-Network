// src/app/profile/[username]/media/page.tsx
import prisma from '@/lib/client'
import { notFound } from 'next/navigation'
import Link from "next/link"
import Image from "next/image"
import ProfileTabBar from '@/app/components/ProfileTabBar'
import MediaTabBar from '@/app/components/MediaTabBar'
import MediaGridItem from '@/app/components/MediaGridItem'
import LeftMenu from '@/app/components/leftMenu/LeftMenu'
import RightMenu from '@/app/components/rightMenu/RightMenu'

type Props = {
    params: { username: string }
    searchParams: { tab?: string }
}

export default async function MediaPage({ params, searchParams }: Props) {
    const { tab = 'images' } = searchParams

    const user = await prisma.user.findUnique({
        where: { username: params.username },
        select: { id: true, username: true, avatar: true },
    })

    if (!user) return notFound()

    // Fonction pour vérifier si le média est une vidéo
    const isVideo = (url: string) => {
        if (!url) return false;

        // Vérifications pour les extensions de fichiers vidéo
        const videoExtensions = /\.(mp4|webm|ogg|mov|avi|wmv|flv|m4v|3gp|mkv)(\?.*)?$/i;
        if (videoExtensions.test(url)) {
            return true;
        }

        // Vérifications pour les chemins contenant 'videos'
        if (url.includes('/videos/')) {
            return true;
        }

        return false;
    };

    // Récupérer tous les posts avec média
    const postsWithMedia = await prisma.post.findMany({
        where: {
            userId: user.id,
            AND: [
                { img: { not: null } },
                { img: { not: "" } },
            ],
        },
        orderBy: {
            createdAt: "desc",
        },
        select: {
            id: true,
            img: true,
            desc: true,
            createdAt: true,
        },
    })

    // Séparer les images et vidéos
    const images = postsWithMedia.filter(post => post.img && !isVideo(post.img))
    const videos = postsWithMedia.filter(post => post.img && isVideo(post.img))

    const currentMedia = tab === 'videos' ? videos : images
    const currentTitle = tab === 'videos' ? 'Videos' : 'Images'

    return (
        <div className="flex gap-8 pt-6">
            <div className="hidden xl:block w-[20%]">
                <LeftMenu type="home" />
            </div>
            <div className="w-full lg:w-[70%] xl:w-[50%]">
                <div className="flex justify-center">
                    <Link href={`/profile/${user.username}`} className="inline-block">
                        <Image src={user.avatar || "/noAvatar.png"} alt="" width={70} height={70} className="rounded-full object-cover object-top w-[70px] h-[70px]  left-0 right-0 m-auto -bottom-6 z-10 mb-5" />
                    </Link>
                </div>
                <h1 className="text-xl font-bold text-center mb-10">{currentTitle} of @{user.username}</h1>

                <MediaTabBar username={user.username} currentTab={tab} />

                <div className="grid grid-cols-3 gap-4 justify-items-center mt-6">
                    {currentMedia.map((post) => (
                        <MediaGridItem
                            key={post.id}
                            postId={post.id.toString()}
                            mediaUrl={post.img!}
                            isVideo={tab === 'videos'}
                            description={post.desc}
                        />
                    ))}
                </div>

                {currentMedia.length === 0 && (
                    <div className="text-center text-[50px] font-[700] text-[#d0d0d0] mt-12">
                        No {tab} yet
                    </div>
                )}
            </div>
            <div className="hidden lg:block w-[30%]">
                <RightMenu />
            </div>
        </div>
    )
}