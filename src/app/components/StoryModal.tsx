"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Story, User } from "@/generated/prisma";

type StoryWithUser = Story & {
  user: User;
};

interface StoryModalProps {
  story: StoryWithUser;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

const StoryModal = ({ story, onClose, onNext, onPrevious }: StoryModalProps) => {
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const STORY_DURATION = 10000; // 10 seconds in milliseconds
  const UPDATE_INTERVAL = 100; // Update progress every 100ms

  useEffect(() => {
    // Reset progress when story changes
    setProgress(0);
    
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Start the progress timer
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + (UPDATE_INTERVAL / STORY_DURATION) * 100;
        if (newProgress >= 100) {
          clearInterval(progressIntervalRef.current!);
          setTimeout(() => onClose(), 100); // Close after progress completes
          return 100;
        }
        return newProgress;
      });
    }, UPDATE_INTERVAL);

    // Clean up interval on unmount
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [story.id, onClose]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && onNext) onNext();
      if (e.key === "ArrowLeft" && onPrevious) onPrevious();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  // Click handlers for navigation
  const handleLeftClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPrevious) onPrevious();
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNext) onNext();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
      onClick={onClose}
    >
      {/* Close button */}
      <button 
        className="absolute top-4 right-4 text-white text-xl z-10" 
        onClick={onClose}
      >
        ✕
      </button>

      {/* User info */}
      <div className="absolute top-8 left-0 right-0 flex items-center px-4 z-10">
        <div className="flex items-center gap-3">
          <Image
            src={story.user.avatar || "/noAvatar.png"}
            alt={story.user.username || "User"}
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
          <span className="text-white font-medium">
            {story.user.name || story.user.username}
          </span>
          <span className="text-gray-300 text-sm">
            {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute top-4 left-0 right-0 px-4 z-10">
        <div className="h-1 bg-gray-600 rounded-full w-full">
          <div 
            className="h-full bg-white rounded-full transition-all" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Story content */}
      <div className="relative max-w-lg max-h-[80vh] w-full h-full flex items-center justify-center">
        {/* Left navigation area */}
        {onPrevious && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer z-10" 
            onClick={handleLeftClick}
          />
        )}
        
        {/* Story image */}
        <Image
          src={story.img}
          alt="Story"
          fill
          className="object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        
        {/* Right navigation area */}
        {onNext && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer z-10" 
            onClick={handleRightClick}
          />
        )}
      </div>
    </div>
  );
};

export default StoryModal;