// src/app/components/ProfileTabBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ProfileTabBarProps {
  username: string;
}

export default function ProfileTabBar({ username }: ProfileTabBarProps) {
  const pathname = usePathname();
  
  // Déterminer si l'onglet est actif
  const isFollowersActive = pathname.includes(`/profile/${username}/followers`);
  const isFollowingActive = pathname.includes(`/profile/${username}/following`);
  const isRequestsActive = pathname.includes(`/profile/${username}/requests`);

  return (
    <div className="flex rounded-full bg-white p-1 mb-8 max-w-lg mx-auto">
      <Link
        href={`/profile/${username}/followers`}
        className={`flex-1 flex items-center justify-center rounded-full py-2 px-4 text-sm font-medium ${
          isFollowersActive 
            ? "bg-black text-white" 
            : "text-gray-700"
        }`}
      >
        Followers
      </Link>
      <Link
        href={`/profile/${username}/following`}
        className={`flex-1 flex items-center justify-center rounded-full py-2 px-4 text-sm font-medium ${
          isFollowingActive 
            ? "bg-black text-white" 
            : "text-gray-700"
        }`}
      >
        Following
      </Link>
      <Link
        href={`/profile/${username}/requests`}
        className={`flex-1 flex items-center justify-center rounded-full py-2 px-4 text-sm font-medium ${
          isRequestsActive 
            ? "bg-black text-white" 
            : "text-gray-700"
        }`}
      >
        Requests
      </Link>
    </div>
  );
}