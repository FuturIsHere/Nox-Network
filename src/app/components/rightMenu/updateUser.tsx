"use client"

import { User } from "@/generated/prisma"
import { useActionState, useState } from "react"
import Image from "next/image"
import { updateProfile } from "@/lib/action"
import LocalUploadWidget from "../LocalUploadWidget"
import { useRouter } from "next/navigation";
import UpdateButton from "./UpdateButton"
import { cleanupUnusedTempFile, extractTempFilename } from '@/lib/clientUploadUtils';

const UpdateUser = ({ user }: { user: User }) => {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [cover, setCover] = useState<any>(null)
    const [state, formAction] = useActionState(updateProfile, { success: false, error: false });

    const handleClose = () => {
        // Nettoyer le fichier temporaire si on ferme sans sauvegarder
        if (cover && cover.secure_url && cover.secure_url.includes('/temp/')) {
            cleanupUnusedTempFile(cover.secure_url);
        }
        
        setOpen(false);
        setCover(null);
        state.success && router.refresh()
    }

    // Fonction pour générer l'URL de prévisualisation
    const getPreviewUrl = (uploadResult: any) => {
        if (!uploadResult) {
            return user.cover || "/noAvatar.png";
        }
        
        // Gérer les différents formats de retour possible
        const url = uploadResult.secure_url || uploadResult.url || uploadResult;
        
        if (typeof url === 'string' && url) {
            console.log('📷 [UpdateUser] URL prévisualisation:', url);
            return url;
        }
        
        console.warn('⚠️ [UpdateUser] Format d\'upload inattendu:', uploadResult);
        return user.cover || "/noAvatar.png";
    };

    // Fonction pour supprimer l'image de prévisualisation
    const removePreviewImage = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Empêche l'ouverture du widget
        
        // Nettoyer le fichier temporaire
        if (cover && cover.secure_url && cover.secure_url.includes('/temp/')) {
            await cleanupUnusedTempFile(cover.secure_url);
        }
        
        setCover(null);
    };

    // Gérer les erreurs d'upload
    const handleUploadError = (error: any) => {
        console.error("Upload error:", error);
        alert("Erreur lors de l'upload du fichier");
    };

    // Fonction pour gérer le succès de l'upload
    const handleUploadSuccess = (result: any) => {
        console.log('📎 [UpdateUser] Upload réussi:', result);
        
        // LocalUploadWidget retourne { info: { secure_url, ... } }
        const uploadInfo = result.info || result;
        
        const coverData = {
            secure_url: uploadInfo.secure_url || uploadInfo.url,
            public_id: uploadInfo.public_id,
            resource_type: uploadInfo.resource_type || 'image',
            temp_filename: uploadInfo.temp_filename // Pour le nettoyage
        };
        
        console.log('📷 [UpdateUser] Données cover:', coverData);
        setCover(coverData);
    };

    return (
        <>
            <div>
                <span className="text-blue-500 text-sm cursor-pointer" onClick={() => setOpen(true)}>Update</span>
                {open && (
                    <div
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-[9.4px]"
                        onClick={handleClose}
                    >
                        <form
                            onClick={(e) => e.stopPropagation()} // ← Empêche le clic sur la modale de propager et fermer
                            action={(formData) => {
                                // Passer l'URL temporaire au lieu de secure_url
                                const coverUrl = cover?.secure_url || "";
                                console.log('🚀 [UpdateUser] Soumission avec cover:', coverUrl);
                                formAction({ formData, cover: coverUrl });
                            }}
                            className="p-12 bg-white rounded-[30px] shadow-md flex flex-col w-full md:w-1/2 xl:w-1/3 relative z-[999999]"
                        >
                            <h1 className="font-[700]">Updates Profile</h1>
                            <div className="mt-4 text-sm text-gray-400">
                                Use the navar profile to change avatar or username.
                            </div>

                            <LocalUploadWidget
                                onSuccess={handleUploadSuccess}
                                onError={handleUploadError}
                                options={{ 
                                    resourceType: "image",
                                    clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                                    maxFileSize: 10000000 // 10MB
                                }}
                            >
                                {({ open }) => {
                                    return (
                                        <div className="flex flex-col gap-4 my-4">
                                            <h1 className="font-[700]">Cover Picture</h1>
                                            <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <Image
                                                        src={getPreviewUrl(cover)}
                                                        alt=""
                                                        width={78}
                                                        height={62}
                                                        className="w-40 h-20 rounded-[12px] object-cover"
                                                    />

                                                    {cover && (
                                                        <button
                                                            type="button"
                                                            onClick={removePreviewImage}
                                                            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold z-10 transition-colors duration-200"
                                                            title="Supprimer l'image"
                                                        >
                                                            ×
                                                        </button>
                                                    )}

                                                </div>

                                                <span
                                                    className="inline-block bg-blue-500 ml-4 text-white text-xs py-2 px-3 rounded-[99px] cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // important pour éviter propagation indésirable
                                                        open();
                                                    }}
                                                >
                                                    Change
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }}
                            </LocalUploadWidget>

                            {/*INPUT */}
                            <div className="grid grid-cols-2 justify-between gap-5">
                                {/* INPUT */}
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="" className="text-sm text-black">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={user.name || ""}
                                        className="ring-1 ring-gray-300 p-[13px] rounded-[10px] text-sm placeholder-gray-300"
                                        name="name"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="" className="text-sm text-black">
                                        Surname
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={user.surname || ""}
                                        className="ring-1 ring-gray-300 p-[13px] rounded-[10px] text-sm placeholder-gray-300"
                                        name="surname"
                                    />
                                </div>
                                {/* INPUT */}
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="" className="text-sm text-black">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={user.description || ""}
                                        className="ring-1 ring-gray-300 p-[13px] rounded-[10px] text-sm placeholder-gray-300"
                                        name="description"
                                    />
                                </div>
                                {/* INPUT */}
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="" className="text-sm text-black">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={user.city || ""}
                                        className="ring-1 ring-gray-300 p-[13px] rounded-[10px] text-sm placeholder-gray-300"
                                        name="city"
                                    />
                                </div>
                                {/* INPUT */}

                                <div className="flex flex-col gap-1">
                                    <label htmlFor="" className="text-sm text-black">
                                        School
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={user.school || ""}
                                        className="ring-1 ring-gray-300 p-[13px] rounded-[10px] text-sm placeholder-gray-300"
                                        name="school"
                                    />
                                </div>
                                {/* INPUT */}

                                <div className="flex flex-col gap-1">
                                    <label htmlFor="" className="text-sm text-black">
                                        Work
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={user.work || ""}
                                        className="ring-1 ring-gray-300 p-[13px] rounded-[10px] text-sm placeholder-gray-300"
                                        name="work"
                                    />
                                </div>
                                {/* INPUT */}

                                <div className="flex flex-col gap-1 mb-4">
                                    <label htmlFor="" className="text-sm text-black">
                                        Website
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={user.website || ""}
                                        className="ring-1 ring-gray-300 p-[13px] rounded-[10px] text-sm placeholder-gray-300"
                                        name="website"
                                    />
                                </div>
                            </div>
                            <UpdateButton />
                            {state.success && (<span className="mt-2 text-green-500">Profile has been updated</span>)}
                            {state.error && (<span className="mt-2 text-red-500">Error</span>)}
                            <div className="absolute text-lg right-3 top-3 cursor-pointer" onClick={handleClose} >
                                <Image src="/reject.png" alt="" className="cursor-pointor" width={30} height={30} />
                            </div>

                        </form>
                    </div>)}
            </div>

        </>
    )
}

export default UpdateUser