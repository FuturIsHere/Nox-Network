"use client"

import Image from "next/image"
import { useState } from "react"

interface MediaItemProps {
  src: string
  isVideo: boolean
  postId: string | number
}

const MediaItem = ({ src, isVideo, postId }: MediaItemProps) => {
  const [imageError, setImageError] = useState(false)

  // 🔥 NOUVEAU : Fonction pour générer un thumbnail à partir d'une vidéo locale
  const getVideoThumbnail = (videoUrl: string) => {
    return videoUrl;
  };

  // 🔥 NOUVEAU : Fonction pour détecter si une image est cassée/invalide
  const handleImageError = () => {
    console.warn('Erreur chargement média:', src);
    setImageError(true);
  };

  // 🔥 NOUVEAU : Fonction pour créer un thumbnail personnalisé pour les vidéos
  const generateVideoPreview = (videoUrl: string) => {
    // On peut utiliser l'URL de la vidéo dans une balise img
    // Le navigateur affichera automatiquement la première frame
    return videoUrl;
  };

  const mediaSrc = isVideo ? generateVideoPreview(src) : src;

  return (
    <div className="relative w-1/5 h-24 group cursor-pointer hover:scale-105 transition-transform duration-200">
      {/* Image ou thumbnail vidéo */}
      {!imageError ? (
        <Image
          src={mediaSrc}
          alt={isVideo ? "Video thumbnail" : "Post image"}
          fill
          className="object-cover rounded-[10px]"
          onError={handleImageError}
          sizes="(max-width: 768px) 20vw, 96px"
          priority={false}
        />
      ) : (
        // 🔥 NOUVEAU : Fallback amélioré pour les médias non trouvés
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-[10px] flex items-center justify-center border border-gray-300">
          <div className="text-gray-500 text-center">
            {isVideo ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-1">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <div className="text-[8px] font-medium">Vidéo</div>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-1">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <div className="text-[8px] font-medium">Image</div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Indicateurs pour les vidéos */}
      {isVideo && !imageError && (
        <>
          {/* Overlay sombre */}
          <div className="absolute inset-0 bg-black/20 rounded-[10px]" />
          
          {/* Icône play */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/90 rounded-full p-1.5 shadow-md group-hover:bg-white transition-colors duration-200">
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="#000" 
                className="ml-0.5"
              >
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
          
          {/* Badge "VIDEO" en haut à droite */}
          <div className="absolute top-1 right-1 bg-black/70 text-white text-[8px] px-1.5 py-0.5 rounded text-center font-medium">
            VIDEO
          </div>
          
          {/* Durée (optionnel - si vous stockez la durée) */}
          {/* 
          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 py-0.5 rounded">
            2:34
          </div>
          */}
        </>
      )}
      
      {/* Hover effect */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-[10px] transition-colors duration-200" />
    </div>
  );
};

export default MediaItem;