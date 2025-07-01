import Image from "next/image"
import Comments from "./Comments"
import { User, Post as PostType } from "@/generated/prisma"
import PostInteraction from "./PostInteraction"
import PostInfo from "./PostInfo"
import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { formatPostDate } from "@/utils/formatPostDate"
import UserHoverCard from "../UserHoverCard"
import VideoPlayer from "./VideoPlayer"

// Type mis à jour pour inclure les données _count de l'utilisateur
type FeedPostType = PostType & {
    user: User & {
        _count: {
            followers: number
            followings: number
        }
    }
} & {
    likes: [{userId: string}]
} & {
    _count: {comments: number}
}

const Post = ({post}: {post: FeedPostType}) => {
    const {userId} = auth();
    const formattedDate = formatPostDate(new Date(post.createdAt));

    // Fonction améliorée pour vérifier si le média est une vidéo
const isVideo = (url: string) => {
  if (!url) return false;
  return url.match(/\.(mp4|webm|ogg|mov|avi|wmv|flv|m4v|3gp|mkv)(\?.*)?$/i) || 
         url.includes('/videos/');
};

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
                            className="text-blue-500 rounded-md hover:underline transition-all duration-200 px-0 py-0 font-medium"
                        >
                            {part}
                        </Link>
                    </UserHoverCard>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    // Debug: Log post data
    console.log("Post data:", { id: post.id, img: post.img, isVideoResult: isVideo(post.img || "") });

    return (
        <div className='flex flex-col p-4 mb-8 bg-white rounded-[30px] shadow-md gap-12'>
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-left">
                    <UserHoverCard user={post.user}>
                        <Link href={`/profile/${post.user.username}`}>
                            <Image width={40} height={40} src={post.user.avatar || "/noAvatar.png"} alt="" className="w-10 h-10 object-cover rounded-full" />
                        </Link>
                    </UserHoverCard>
                    <div className="flex flex-col">
                         <UserHoverCard user={post.user}>                        
                            <Link href={`/profile/${post.user.username}`}>
                            <span className="text-[17px] font-[600] text-black">
                                {(post.user.name && post.user.surname) ? post.user.name + " " + post.user.surname : post.user.username}
                            </span>
                      
                        </Link>
                              </UserHoverCard>
                        <span className="text-[13px] text-left font-[400] text-[#86868b]">{formattedDate}</span>
                    </div>
                </div>
                {userId === post.user.id && <div className="cursor-pointer"><PostInfo postId={post.id} /></div>}
            </div>
            
            <div className="flex flex-col gap-4 text-left">
                {post.img && (
                    <div className="w-full min-h-96 relative">
                        {isVideo(post.img) ? (
                            <VideoPlayer 
                                src={post.img} 
                                format="square"
                                className=""
                            />
                        ) : (
                            <Image src={post.img} fill alt="" className="object-cover rounded-[20px]" />
                        )}
                    </div>
                )}
                <div className="text-[#86868b] font-[400] text-[16px] leading-relaxed">
                    {formatTextWithMentions(post.desc)}                
                </div>
            </div>
            
            <PostInteraction postId={post.id} likes={post.likes.map(like => like.userId)} commentNumber={post._count.comments}/>
            <Comments postId={post.id}/>
        </div>
    )
}

export default Post