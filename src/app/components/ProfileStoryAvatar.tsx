"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Story, User } from "@/generated/prisma";
import StoryViewer from '@/app/components/StoryViewer';

type StoryWithUser = Story & {
  user: User;
};

interface ProfileStoryAvatarProps {
  user: User;
  stories: StoryWithUser[];
  currentUserId: string | null;
}

const ProfileStoryAvatar = ({ user, stories, currentUserId }: ProfileStoryAvatarProps) => {
  const [isClient, setIsClient] = useState(false);
  const [viewingStories, setViewingStories] = useState(false);
  const [viewedStoriesMap, setViewedStoriesMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsClient(true);
    
    const loadViewedStories = () => {
      if (typeof window !== 'undefined') {
        try {
          const viewedStories = JSON.parse(localStorage.getItem('viewedStories') || '[]');
          const viewedMap: Record<string, boolean> = {};
          viewedStories.forEach((id: string) => {
            viewedMap[id] = true;
          });
          setViewedStoriesMap(viewedMap);
        } catch (error) {
          console.error("Error loading viewed stories:", error);
          setViewedStoriesMap({});
        }
      }
    };
    
    loadViewedStories();
  }, []);

  // Vérifier si toutes les stories de l'utilisateur ont été vues
  const areAllStoriesViewed = () => {
    if (!isClient || stories.length === 0) return false;
    
    return stories.every(story => 
      viewedStoriesMap[story.id.toString()]
    );
  };

  // Marquer les stories comme vues
  const markStoriesAsViewed = () => {
    if (!isClient) return;
    
    try {
      const viewedStories = JSON.parse(localStorage.getItem('viewedStories') || '[]');
      let hasNewViews = false;
      
      stories.forEach(story => {
        const storyIdStr = story.id.toString();
        if (!viewedStories.includes(storyIdStr)) {
          viewedStories.push(storyIdStr);
          hasNewViews = true;
        }
      });
      
      if (hasNewViews) {
        localStorage.setItem('viewedStories', JSON.stringify(viewedStories));
        
        const newViewedMap: Record<string, boolean> = {};
        viewedStories.forEach((id: string) => {
          newViewedMap[id] = true;
        });
        setViewedStoriesMap(newViewedMap);
      }
    } catch (error) {
      console.error("Error marking stories as viewed:", error);
    }
  };

  const openStoryViewer = () => {
    if (stories.length > 0) {
      setViewingStories(true);
      markStoriesAsViewed();
    }
  };

  const closeStoryViewer = () => {
    setViewingStories(false);
  };

  const handleStoryDeleted = (deletedStoryId: string) => {
    // Optionnel: supprimer aussi de localStorage
    if (typeof window !== 'undefined') {
      try {
        const viewedStories = JSON.parse(localStorage.getItem('viewedStories') || '[]');
        const updatedViewedStories = viewedStories.filter((id: string) => id !== deletedStoryId);
        localStorage.setItem('viewedStories', JSON.stringify(updatedViewedStories));
        
        setViewedStoriesMap(prev => {
          const newMap = { ...prev };
          delete newMap[deletedStoryId];
          return newMap;
        });
      } catch (error) {
        console.error("Error updating viewed stories after deletion:", error);
      }
    }
  };

  const hasStories = stories.length > 0;
  const isViewed = isClient && areAllStoriesViewed();

  return (
    <>
      <style jsx>{`
        @keyframes rotate-gradient {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        .story-gradient-ring {
          animation: rotate-gradient 2s linear infinite;
        }
      `}</style>
      
      <div 
        className={`absolute left-1/2 transform -translate-x-1/2 -bottom-16 ${hasStories ? 'cursor-pointer' : ''}`}        
        onClick={hasStories ? openStoryViewer : undefined}
      >
        {hasStories ? (
          // Avatar avec gradient si des stories sont disponibles
          <div className="relative w-32 h-32">
            <div 
              className={`absolute inset-0 rounded-[99999px] p-[5px] ${
                isViewed 
                  ? "bg-gray-300" 
                  : "bg-gradient-to-t from-[rgba(48,99,212,1)] to-[rgba(28,196,245,1)] story-gradient-ring"
              }`}
            >
            </div>
            <div className="absolute inset-[5px] bg-[#f5f5f7] rounded-full flex items-center justify-center">
              <Image 
                src={user.avatar || "/noAvatar.png"} 
                alt="" 
                width={120} 
                height={120} 
                className="w-[120px] h-[120px] rounded-full object-cover" 
              />
            </div>
          </div>
        ) : (
          // Avatar normal sans gradient si pas de stories
          <Image 
            src={user.avatar || "/noAvatar.png"} 
            alt="" 
            width={128} 
            height={128} 
            className="w-32 h-32 rounded-full ring ring-[#f5f5f7] object-cover" 
          />
        )}
      </div>

      {/* Story Viewer */}
      {viewingStories && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          initialStoryIndex={0}
          onClose={closeStoryViewer}
          onStoryDeleted={handleStoryDeleted}
        />
      )}
    </>
  );
};

export default ProfileStoryAvatar;