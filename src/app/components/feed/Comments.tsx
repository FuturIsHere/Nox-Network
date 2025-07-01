import prisma from "@/lib/client"
import Image from "next/image"
import CommentList from "./CommentList"

const Comments = async ({postId}:{postId:number}) => {

    const comments = await prisma.comment.findMany({
        where: {
            postId,
            parentId: null, // Ne récupérer que les commentaires principaux
        },
        include:{
            user: true,
            likes: {
                select: {
                    userId: true
                }
            },
            _count: {
                select: {
                    likes: true,
                    replies: true // Compter les réponses
                }
            },
            replies: {
                include: {
                    user: true,
                    likes: {
                        select: {
                            userId: true
                        }
                    },
                    _count: {
                        select: {
                            likes: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "asc" // Les réponses par ordre chronologique
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    })
    
    return (
        <div>
           <CommentList comments={comments} postId={postId}/>
        </div>
    )
}
export default Comments;