// src/app/components/MediaTabBar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MediaTabBarProps {
  username: string
  currentTab: string
}

const MediaTabBar = ({ username, currentTab }: MediaTabBarProps) => {
  const pathname = usePathname()

  return (
  <div className="flex rounded-full bg-white p-1 mb-8 max-w-md mx-auto">
        <Link
          href={`/profile/${username}/media?tab=images`}
          className={`flex-1 flex items-center justify-center rounded-full py-2 px-4 text-sm font-medium ${
            currentTab === 'images'
              ? "bg-black text-white" 
            : "text-gray-700"
          }`}
        >
          Images
        </Link>
        <Link
          href={`/profile/${username}/media?tab=videos`}
          className={`flex-1 flex items-center justify-center rounded-full py-2 px-4 text-sm font-medium ${
            currentTab === 'videos'
             ? "bg-black text-white" 
            : "text-gray-700"
          }`}
        >
          Videos
        </Link>
      </div>
    
  )
}

export default MediaTabBar