import { auth } from "@clerk/nextjs/server"
import Post from "./Post"
import prisma from "@/lib/client";

const Feed = async ({ username }: { username?: string }) => {
  const { userId } = await auth()
  let posts: any[] = [];

  if (username) {
    posts = await prisma.post.findMany({
      where: {
        user: {
          username: username,
        }
      },
      include: {
        user: {
          include: {
            _count: {
              select: {
                followers: true,
                followings: true
              }
            }
          }
        },
        likes: {
          select: {
            userId: true
          }
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", 
      }
    })
  }
  
  if (!username && userId) {
    const following = await prisma.follower.findMany({
      where: {
        followerId: userId
      },
      select: {
        followingId: true,
      }
    });
    
    const followingIds = following.map(f => f.followingId)
    const ids = [userId, ...followingIds]
    
    posts = await prisma.post.findMany({
      where: {
        userId: {
          in: ids
        }
      },
      include: {
        user: {
          include: {
            _count: {
              select: {
                followers: true,
                followings: true
              }
            }
          }
        },
        likes: {
          select: {
            userId: true
          }
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", 
      }
    })
  }
  
  return (
    <div className='text-center mt-[10%] text-[50px] font-[700] text-[#d0d0d0]'>
      {posts?.length ? (posts.map)(post => (<Post key={post.id} post={post} />)) : "No post"}
    </div>
  )
}

export default Feed