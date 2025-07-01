"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Story, User } from "@/generated/prisma";
import { formatPostDate } from "@/utils/formatPostDate";
import { deleteStory } from "@/lib/action";
import { useUser } from "@clerk/nextjs";

type StoryWithUser = Story & {
  user: User;
};

type MediaType = "image" | "video";

interface StoryViewerProps {
  stories: StoryWithUser[];
  initialStoryIndex?: number;
  onClose: () => void;
  onNextUser?: () => void;
  onPreviousUser?: () => void;
  onStoryDeleted?: (storyId: string) => void; // Nouveau callback pour la suppression
}

const StoryViewer = ({
  stories,
  initialStoryIndex = 0,
  onClose,
  onNextUser,
  onPreviousUser,
  onStoryDeleted,
}: StoryViewerProps) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const STORY_DURATION = 10000; // 10 seconds per story
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMountedRef = useRef<boolean>(true);

  const { user } = useUser();

  if (!stories.length || currentStoryIndex >= stories.length) {
    return null;
  }

  const currentStory = stories[currentStoryIndex];
  const isOwnStory = user?.id === currentStory.userId;

  // Cleanup function to be reused in multiple places
  const cleanupTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Safely update state only if component is still mounted
  const safeSetProgress = useCallback((newProgress: number) => {
    if (isMountedRef.current) {
      setProgress(newProgress);
    }
  }, []);

  const safePlayVideo = useCallback(() => {
    const video = videoRef.current;
    if (video && video.isConnected) {
      video
        .play()
        .catch((err) => {
          console.warn("Video play interrupted:", err.message);
        });
    }
  }, []);

  // Handle story deletion
  const handleDeleteStory = async () => {
    if (!isOwnStory || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteStory(currentStory.id);

      // Notifier le parent de la suppression
      if (onStoryDeleted) {
        onStoryDeleted(currentStory.id);
      }

      // Si c'était la dernière story, fermer le viewer
      if (stories.length === 1) {
        onClose();
      } else {
        // Sinon, passer à la story suivante ou précédente
        if (currentStoryIndex < stories.length - 1) {
          setCurrentStoryIndex(currentStoryIndex);
        } else if (currentStoryIndex > 0) {
          setCurrentStoryIndex(currentStoryIndex - 1);
        } else {
          onClose();
        }
      }
    } catch (error) {
      console.error("Error deleting story:", error);
      alert("Erreur lors de la suppression de la story");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Detect media type
  useEffect(() => {
    const mediaUrl = currentStory.img;
    const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(mediaUrl);

    if ((isVideo && mediaType !== "video") || (!isVideo && mediaType !== "image")) {
      setProgress(0);
      setMediaLoaded(false);
      setMediaType(isVideo ? "video" : "image");

      if (isVideo && videoRef.current) {
        const video = videoRef.current;
        video.currentTime = 0;

        const playTimeout = setTimeout(() => {
          if (!isPaused && isMountedRef.current && videoRef.current?.isConnected) {
            safePlayVideo();
          }
        }, 0);

        return () => clearTimeout(playTimeout);
      }
    }
  }, [currentStoryIndex, currentStory.img, mediaType, isPaused, safePlayVideo]);

  // Navigation functions
  const moveToNextStory = useCallback(() => {
    cleanupTimers();
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prevIndex => prevIndex + 1);
      setProgress(0);
    } else {
      if (onNextUser) {
        onNextUser();
      } else {
        onClose();
      }
    }
  }, [currentStoryIndex, stories.length, onClose, onNextUser, cleanupTimers]);

  const moveToPreviousStory = useCallback(() => {
    cleanupTimers();
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prevIndex => prevIndex - 1);
      setProgress(0);
    } else {
      if (onPreviousUser) {
        onPreviousUser();
      }
    }
  }, [currentStoryIndex, cleanupTimers, onPreviousUser]);

  // Progress management for stories
  useEffect(() => {
    if (isPaused || !mediaLoaded) return;

    cleanupTimers();

    if (mediaType === "video" && videoRef.current) {
      const videoDuration = videoRef.current.duration * 1000;
      const actualDuration = isNaN(videoDuration) || videoDuration === 0 ? STORY_DURATION : videoDuration;

      safePlayVideo();
      startTimeRef.current = Date.now();
      safeSetProgress(0);

      intervalRef.current = setInterval(() => {
        if (videoRef.current && isMountedRef.current && document.body.contains(videoRef.current)) {
          const elapsedTime = videoRef.current.currentTime * 1000;
          const newProgress = (elapsedTime / actualDuration) * 100;

          if (newProgress >= 100 || videoRef.current.ended) {
            cleanupTimers();
            moveToNextStory();
          } else {
            safeSetProgress(newProgress);
          }
        }
      }, 50);
    } else {
      startTimeRef.current = Date.now();
      safeSetProgress(0);

      intervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          const elapsedTime = Date.now() - startTimeRef.current;
          const newProgress = (elapsedTime / STORY_DURATION) * 100;

          if (newProgress >= 100) {
            cleanupTimers();
            moveToNextStory();
          } else {
            safeSetProgress(newProgress);
          }
        }
      }, 50);
    }

    return cleanupTimers;
  }, [currentStoryIndex, isPaused, moveToNextStory, mediaType, mediaLoaded, cleanupTimers, safeSetProgress, safePlayVideo]);

  // Pause/resume management
  useEffect(() => {
    if (isPaused) {
      pausedTimeRef.current = Date.now();
      cleanupTimers();

      if (mediaType === "video" && videoRef.current) {
        videoRef.current.pause();
      }
    } else if (mediaLoaded) {
      if (pausedTimeRef.current > 0) {
        const pauseDuration = Date.now() - pausedTimeRef.current;
        startTimeRef.current += pauseDuration;
        pausedTimeRef.current = 0;
      }

      if (mediaType === "video" && videoRef.current) {
        safePlayVideo();
      }

      if (!intervalRef.current && isMountedRef.current) {
        if (mediaType === "video" && videoRef.current) {
          const videoDuration = videoRef.current.duration * 1000;
          const actualDuration = isNaN(videoDuration) || videoDuration === 0 ? STORY_DURATION : videoDuration;

          intervalRef.current = setInterval(() => {
            if (videoRef.current && isMountedRef.current && document.body.contains(videoRef.current)) {
              const elapsedTime = videoRef.current.currentTime * 1000;
              const newProgress = (elapsedTime / actualDuration) * 100;

              if (newProgress >= 100 || videoRef.current.ended) {
                cleanupTimers();
                moveToNextStory();
              } else {
                safeSetProgress(newProgress);
              }
            }
          }, 50);
        } else {
          intervalRef.current = setInterval(() => {
            if (isMountedRef.current) {
              const elapsedTime = Date.now() - startTimeRef.current;
              const newProgress = (elapsedTime / STORY_DURATION) * 100;

              if (newProgress >= 100) {
                cleanupTimers();
                moveToNextStory();
              } else {
                safeSetProgress(newProgress);
              }
            }
          }, 50);
        }
      }
    }

    return cleanupTimers;
  }, [isPaused, moveToNextStory, mediaType, mediaLoaded, cleanupTimers, safeSetProgress, safePlayVideo]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanupTimers();

      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch (err) {
          console.error("Error cleaning up video:", err);
        }
      }
    };
  }, [cleanupTimers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMountedRef.current) return;

      if (e.key === "ArrowLeft") {
        moveToPreviousStory();
      } else if (e.key === "ArrowRight") {
        moveToNextStory();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveToNextStory, moveToPreviousStory, onClose]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentStory && currentStory.id) {
      try {
        const viewedStories = JSON.parse(localStorage.getItem('viewedStories') || '[]');
        const storyIdStr = currentStory.id.toString();

        if (!viewedStories.includes(storyIdStr)) {
          viewedStories.push(storyIdStr);
          localStorage.setItem('viewedStories', JSON.stringify(viewedStories));
        }
      } catch (error) {
        console.error("Error updating viewed stories:", error);
      }
    }
  }, [currentStory]);

  const handleLeftSideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveToPreviousStory();
  };

  const handleRightSideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveToNextStory();
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleMediaLoaded = () => {
    setMediaLoaded(true);
  };

  const timeElapsed = formatPostDate(new Date(currentStory.createdAt));

useEffect(() => {
  if (showDeleteModal) {
    handlePause();
  } else {
    handleResume();
  }
}, [showDeleteModal]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[9.4px] z-[9999999]"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="absolute md:flex hidden top-2 left-2 w-[20%]">
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="Homepage"
            width={26}
            height={26}
            className="w-8 h-8"
            unoptimized
          />
          <span className="font-[700] ml-2 text-white text-[20px]">Nox Network</span>
        </div>
      </div>

      <div
        className="relative w-full max-w-md h-full max-h-screen flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-3 left-0 right-0 px-2 pt-2 flex gap-1 z-10">
          {stories.map((_, index) => (
            <div
              key={index}
              className="h-[2px] bg-gray-500/70 rounded-full flex-1"
            >
              {index === currentStoryIndex ? (
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              ) : index < currentStoryIndex ? (
                <div className="h-full bg-white rounded-full w-full" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="absolute top-5 left-0 right-0 px-4 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Image
                src={currentStory.user.avatar || "/noAvatar.png"}
                alt={currentStory.user.username || "User"}
                width={38}
                height={38}
                className="rounded-full object-cover"
                unoptimized
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/noAvatar.png";
                }}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">
                  {currentStory.user.username || "user"}
                </span>
                <span className="text-gray-300 text-xs">
                  {timeElapsed}
                </span>
              </div>
            </div>
          </div>

          {/* Bouton de suppression - Visible seulement pour ses propres stories */}

        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-full h-full flex">
            <div
              className="absolute left-0 top-0 w-1/2 h-full z-20 cursor-pointer"
              onClick={handleLeftSideClick}
              onMouseDown={handlePause}
              onMouseUp={handleResume}
              onTouchStart={handlePause}
              onTouchEnd={handleResume}
            />

            <div
              className="absolute right-0 top-0 w-1/2 h-full z-20 cursor-pointer"
              onClick={handleRightSideClick}
              onMouseDown={handlePause}
              onMouseUp={handleResume}
              onTouchStart={handlePause}
              onTouchEnd={handleResume}
            />

            {mediaType === "image" ? (
              <div className="w-full h-full flex items-center justify-center">
                <Image
                  src={currentStory.img}
                  alt="Story"
                  width={500}
                  height={900}
                  className="max-w-full max-h-full object-contain"
                  unoptimized
                  priority
                  onLoad={handleMediaLoaded}
                  onError={(e) => {
                    console.error("Image error:", e);
                    handleMediaLoaded();
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={currentStory.img}
                  className="max-w-full max-h-full object-contain"
                  playsInline
                  muted={false}
                  controls={false}
                  onEnded={moveToNextStory}
                  onCanPlay={handleMediaLoaded}
                  onError={(e) => {
                    console.error("Video error:", e);
                    handleMediaLoaded();
                    setTimeout(moveToNextStory, 1000);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bouton de fermeture */}
      <div
        className="absolute top-8 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 cursor-pointer z-20"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <span className="text-white text-xl">&times;</span>
      </div>
      {isOwnStory && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteModal(true);
          }}
          className="absolute w-10 h-10 right-5 bottom-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors z-20"
          disabled={isDeleting}
        >
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <div className="bg-white rounded-[20px] p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete this story ?</h3>
            <p className="text-gray-600 mb-6">
              This action is irreversible. Do you really want to delete this story ?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStory}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded-[99px] hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryViewer;