"use client"

import { useState } from "react"
import Image from "next/image"
import { deleteComment } from "@/lib/action";

interface CommentInfoProps {
    commentId: number;
    onDelete: (commentId: number) => void;
    isReply?: boolean;
    parentId?: number | null; // Changez ici : ajoutez | null
    onDeleteReply?: (parentId: number, replyId: number) => void;
}

const CommentInfo = ({ 
    commentId, 
    onDelete, 
    isReply = false, 
    parentId, 
    onDeleteReply 
}: CommentInfoProps) => {
    const [open, setOpen] = useState(false);
    
const handleDelete = async () => {
    try {
        // Fermer le menu immédiatement
        setOpen(false);
        
        // Mettre à jour l'UI d'abord pour un feedback immédiat
        if (isReply && parentId && onDeleteReply) {
            onDeleteReply(parentId, commentId);
        } else {
            onDelete(commentId);
        }
        
        // Puis exécuter la suppression côté serveur
        await deleteComment(commentId);
        
    } catch (error) {
        console.error("Error deleting comment:", error);
        // En cas d'erreur, vous pourriez vouloir restaurer l'état précédent
        // ou afficher un message d'erreur à l'utilisateur
    }
};
    return (
        <div className="relative right-0">
            <Image 
                className="cursor-pointer" 
                width={16} 
                height={16} 
                src="/more.png" 
                alt="" 
                onClick={() => setOpen((prev) => !prev)} 
            />

            {open && (
                <div className="absolute top-4 right-0 bg-white p-4 w-32 rounded-lg flex flex-col gap-2 text-[14px] shadow-lg z-30">
                    <button 
                        onClick={handleDelete}
                        className="text-[#ff1b0e] font-[400] flex items-center gap-2"
                    >
                        <Image 
                            className="cursor-pointer" 
                            width={16} 
                            height={16} 
                            src="/trash.png" 
                            alt="" 
                        />
                        <span>Delete</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default CommentInfo