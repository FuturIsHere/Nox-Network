"use client"

import { useState } from "react"
import Image from "next/image"
import { deletePost } from "@/lib/action";

const PostInfo = ({ postId }: { postId: number }) => {
    const [open, setOpen] = useState(false);
    const deletePostWithId = deletePost.bind(null, postId)
    return (
        <div className="relative">
            <Image className="cursor-pointor" width={16} height={16} src="/more.png" alt="" onClick={() => setOpen((prev) => !prev)} />

            {open && (
                <div className="absolute top-4 right-0 bg-white p-4 w-32 rounded-lg flex flex-col gap-2 text-[14px] shadow-lg z-30">
                    <form action={deletePostWithId}>
                        <button className="text-[#ff1b0e] font-[400] flex items-center gap-2">
                            <Image className="cursor-pointor" width={16} height={16} src="/trash.png" alt="" onClick={() => setOpen((prev) => !prev)} />
                            <span>Delete</span>
                        </button>
                    </form>
                </div>
            )
            }
        </div>
    );
}

export default PostInfo