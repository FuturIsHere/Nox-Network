// src/app/components/MediaGridItem.tsx
import Image from "next/image"
import Link from "next/link"

interface MediaGridItemProps {
  postId: string
  mediaUrl: string
  isVideo: boolean
  description?: string
}

const MediaGridItem = ({ postId, mediaUrl, isVideo, description }: MediaGridItemProps) => {
  return (
    <div className="w-full aspect-square">
      <Link href={`/post/${postId}`} className="block w-full h-full">
        <div className="relative w-full h-full bg-white rounded-[20px] shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 group">
          {isVideo ? (
            <div className="relative w-full h-full">
              <video
                src={mediaUrl}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
              />
              {/* Overlay avec icône play */}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-200">
                <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <svg 
                    className="w-6 h-6 text-gray-800 ml-1" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <Image
                src={mediaUrl}
                alt="Media"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              />
              {/* Overlay pour les images au survol */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200" />
            </div>
          )}
          
          {/* Tooltip avec description tronquée */}
          {description && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-white text-xs line-clamp-2">
                {description.length > 60 ? `${description.substring(0, 60)}...` : description}
              </p>
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}

export default MediaGridItem