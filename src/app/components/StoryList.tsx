"use client";

import { Story, User } from "@/generated/prisma";
import { useUser } from "@clerk/nextjs";
import LocalUploadWidget from "./LocalUploadWidget";
import Image from "next/image";
import { useOptimistic, useState, useMemo, useEffect } from "react";
import { addStory } from "@/lib/action";
import StoryViewer from "./StoryViewer";

type StoryWithUser = Story & {
  user: User;
};

type UserStories = {
  userId: string;
  username: string;
  avatar: string;
  stories: StoryWithUser[];
};

const StoryList = ({
  stories,
  userId,
}: {
  stories: StoryWithUser[];
  userId: string;
}) => {
  const [storyList, setStoryList] = useState(stories);
  const [img, setImg] = useState<any>();
  const [viewingStories, setViewingStories] = useState(false);
  const [viewingUserIndex, setViewingUserIndex] = useState(0);
  const [viewingStoryIndex, setViewingStoryIndex] = useState(0);
  const [viewedStoriesMap, setViewedStoriesMap] = useState<Record<string, boolean>>({});
  const [isClient, setIsClient] = useState(false);

  const { user, isLoaded } = useUser();

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

  // Nettoyage automatique lors du démontage du composant
  useEffect(() => {
    return () => {
      // Nettoyer le fichier temporaire si le composant est démonté
      if (img?.temp_filename) {
        fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
          method: 'DELETE',
        }).catch(console.error);
      }
    };
  }, [img?.temp_filename]);

  // Nettoyage automatique périodique
  useEffect(() => {
    // Nettoyer les fichiers temporaires anciens toutes les 30 minutes
    const cleanupInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/cleanup-temp', {
          method: 'POST',
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.cleaned > 0) {
            console.log('🧹 Nettoyage automatique:', result.message);
          }
        }
      } catch (error) {
        console.error('Erreur nettoyage automatique:', error);
      }
    }, 30 * 60 * 1000); // Toutes les 30 minutes

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  const [optimisticStories, addOptimisticStory] = useOptimistic(
    storyList,
    (state, value: StoryWithUser) => [value, ...state]
  );

  const groupedStories = useMemo(() => {
    const storiesByUser: Record<string, UserStories> = {};
    
    optimisticStories.forEach(story => {
      if (!storiesByUser[story.userId]) {
        storiesByUser[story.userId] = {
          userId: story.userId,
          username: story.user.name || story.user.username,
          avatar: story.user.avatar || "/noAvatar.png",
          stories: []
        };
      }
      storiesByUser[story.userId].stories.push(story);
    });
    
    return Object.values(storiesByUser).map(userStory => {
      userStory.stories.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return userStory;
    });
  }, [optimisticStories]);

  const getStoryIdString = (storyId: string | number): string => {
    return storyId.toString();
  };

  // Fonction pour générer l'URL de prévisualisation
  const getPreviewUrl = (uploadResult: any) => {
    if (!uploadResult) return "/story2.png";
    
    // Si c'est une vidéo, utiliser l'URL directement pour l'aperçu temporaire
    if (uploadResult.resource_type === 'video') {
      // Pour les fichiers temporaires, utiliser l'URL directe
      if (uploadResult.is_temporary) {
        return uploadResult.secure_url;
      }
      // Sinon, utiliser l'image par défaut
      return "/story2.png";
    }
    
    // Si c'est une image, on retourne l'URL normale
    return uploadResult.secure_url || "/story2.png";
  };

  // Fonction pour annuler l'upload et nettoyer
  const cancelUpload = async () => {
    if (img?.temp_filename) {
      try {
        await fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
          method: 'DELETE',
        });
        console.log('🗑️ Fichier temporaire nettoyé lors de l\'annulation');
      } catch (error) {
        console.error('Erreur lors du nettoyage:', error);
      }
    }
    setImg(null);
  };

  // Gérer les erreurs d'upload avec nettoyage
  const handleUploadError = async (error: any) => {
    console.error("Upload error:", error);
    
    // Nettoyer le fichier temporaire en cas d'erreur
    if (img?.temp_filename) {
      try {
        await fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
          method: 'DELETE',
        });
      } catch (cleanupError) {
        console.error('Erreur lors du nettoyage:', cleanupError);
      }
    }
    
    alert("Erreur lors de l'upload du fichier");
    setImg(null);
  };

  const add = async () => {
    if (!img?.secure_url) return;
    if (!user || !userId) return;

    const optimisticStory: StoryWithUser = {
      id: `temp-${Date.now()}-${Math.random()}`,
      img: img.secure_url, // URL temporaire pour l'aperçu
      createdAt: new Date(Date.now()),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      userId: userId,
      user: {
        id: userId,
        username: user.username || "Sending...",
        avatar: user?.imageUrl || null,
        cover: null,
        description: null,
        name: user?.firstName || null,
        surname: user?.lastName || null,
        city: null,
        work: null,
        school: null,
        website: null,
        createdAt: new Date(Date.now()),
        isOnline: false,
        lastSeen: null,
      },
    };

    addOptimisticStory(optimisticStory);

    try {
      console.log('🚀 Création de la story avec fichier temporaire:', img.temp_filename);
      
      // Passer l'URL temporaire - elle sera finalisée dans addStory
      const createdStory = await addStory(img.secure_url);
      
      if (createdStory) {
        setStoryList((prev) => [createdStory, ...prev]);
        console.log('✅ Story créée avec succès');
      }
      
      setImg(null);
    } catch (err) {
      console.error("❌ Erreur lors de la création de la story:", err);
      
      // En cas d'erreur, nettoyer le fichier temporaire
      if (img?.temp_filename) {
        fetch(`/api/cleanup-temp?filename=${img.temp_filename}`, {
          method: 'DELETE',
        }).catch(console.error);
      }
    }
  };

  const openStoryViewer = (userIndex: number) => {
    setViewingUserIndex(userIndex);
    setViewingStoryIndex(0);
    setViewingStories(true);
    
    const userStories = groupedStories[userIndex].stories;
    userStories.forEach(story => markStoryAsViewed(story.id));
  };

  const closeStoryViewer = () => {
    setViewingStories(false);
  };

  const isUserStoriesViewed = (userStories: UserStories) => {
    if (!isClient) return false;
    
    return userStories.stories.every(story => 
      viewedStoriesMap[getStoryIdString(story.id)]
    );
  };
  
  const markStoryAsViewed = (storyId: number | string) => {
    if (!isClient) return;
    
    try {
      const viewedStories = JSON.parse(localStorage.getItem('viewedStories') || '[]');
      const storyIdStr = getStoryIdString(storyId);
      
      if (!viewedStories.includes(storyIdStr)) {
        viewedStories.push(storyIdStr);
        localStorage.setItem('viewedStories', JSON.stringify(viewedStories));
        
        setViewedStoriesMap(prev => ({
          ...prev,
          [storyIdStr]: true
        }));
      }
    } catch (error) {
      console.error("Error marking story as viewed:", error);
    }
  };

  // Fonction pour gérer la suppression d'une story
  const handleStoryDeleted = (deletedStoryId: string) => {
    setStoryList(prev => prev.filter(story => story.id !== deletedStoryId));
    
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

  // Fonction pour passer aux stories de l'utilisateur suivant
  const goToNextUserStories = () => {
    const nextUserIndex = viewingUserIndex + 1;

    if (nextUserIndex < groupedStories.length) {
      setViewingUserIndex(nextUserIndex);
      setViewingStoryIndex(0);
      
      const nextUserStories = groupedStories[nextUserIndex].stories;
      nextUserStories.forEach(story => markStoryAsViewed(story.id));
    } else {
      setViewingStories(false);
    }
  };

  // Fonction pour passer aux stories de l'utilisateur précédent
  const goToPreviousUserStories = () => {
    const prevUserIndex = viewingUserIndex - 1;

    if (prevUserIndex >= 0) {
      setViewingUserIndex(prevUserIndex);
      setViewingStoryIndex(0);

      const prevUserStories = groupedStories[prevUserIndex].stories;
      prevUserStories.forEach(story => markStoryAsViewed(story.id));
    } else {
      setViewingStories(false);
    }
  };

  const allStoriesToView = useMemo(() => {
    if (viewingStories && groupedStories.length > 0 && groupedStories[viewingUserIndex]) {
      return groupedStories[viewingUserIndex].stories;
    }
    return [];
  }, [viewingStories, groupedStories, viewingUserIndex]);

  const hasNoStories = groupedStories.length === 0 || 
    (groupedStories.length === 1 && groupedStories[0].userId === userId && groupedStories[0].stories.length === 0);

  return (
    <>
      <LocalUploadWidget
        onSuccess={(result) => {
          console.log("📁 Story upload vers dossier temporaire:", result.info);
          setImg(result.info);
        }}
        onError={handleUploadError}
        options={{
          multiple: false,
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv'],
          maxFileSize: 50000000 // 50MB
        }}
      >
        {({ open }) => {
          return (
            <div className="flex flex-col items-center gap-2 cursor-pointer">
              <div className="relative w-20 h-20">
                {/* Container avec dimensions fixes et overflow hidden pour maintenir la forme circulaire */}
                <div className="w-[80px] h-[80px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                  <Image
                    src={getPreviewUrl(img) || "/story2.png"}
                    alt=""
                    width={80}
                    height={80}
                    className="w-full h-full object-contain"
                    onClick={() => open()}
                  />
                </div>
                
      
                
                {/* Croix de suppression pour l'image de prévisualisation */}
                {img && (
                  <button
                    onClick={cancelUpload} // Utiliser cancelUpload au lieu de removePreviewImage
                    className="absolute -top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold z-10 transition-colors duration-200"
                    title="Supprimer l'image"
                    type="button"
                  >
                    ×
                  </button>
                )}
                
                {/* Indicateur vidéo si c'est une vidéo */}
                {img?.resource_type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black bg-opacity-50 rounded-full p-1">
                      <svg 
                        className="w-4 h-4 text-white" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                  </div>
                )}
                
                {/* Bouton plus seulement si pas d'image */}
                {!img && (
                  <div className="absolute bottom-0 right-0 ring ring-[#f5f5f7] ring-offset-0 bg-[#f5f5f7] rounded-full ">
                    <Image
                      src="/plus.png"
                      alt=""
                      width={70}
                      height={70}
                      className="w-7 h-7"
                      onClick={() => open()}
                    />
                  </div>
                )}
              </div>
              {img ? (
                <form action={add}>
                  <button className="text-xs bg-blue-500 p-1 rounded-md text-white" type="submit">
                    Send
                  </button>
                </form>
              ) : (
                <span className="font-medium">Add a Story</span>
              )}
            </div>
          );
        }}
      </LocalUploadWidget>

      {groupedStories.map((userStory, userIndex) => {
        if (userStory.stories.length === 0 && userStory.userId !== userId) {
          return null;
        }
        
        const isViewed = isClient && isUserStoriesViewed(userStory);
        
        return (
          <div
            className="flex flex-col items-center gap-2 cursor-pointer"
            key={userStory.userId}
            onClick={() => openStoryViewer(userIndex)}
          >
            <div className="relative w-20 h-20">
              <div 
                className={`absolute inset-0 rounded-full p-[4px] flex items-center justify-center ${
                  isViewed 
                    ? "bg-gray-300" 
                    : "bg-gradient-to-t from-[rgba(48,99,212,1)] to-[rgba(28,196,245,1)]"
                }`}
              >
                <div className="bg-[#f5f5f7] rounded-full w-full h-full flex items-center justify-center overflow-hidden">
                  <Image
                    src={userStory.avatar}
                    alt=""
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            <span className="font-medium text-xs">
              {userStory.username}
            </span>
          </div>
        );
      })}

      {viewingStories && allStoriesToView.length > 0 && (
        <StoryViewer
          stories={allStoriesToView}
          initialStoryIndex={viewingStoryIndex}
          onClose={closeStoryViewer}
          onNextUser={goToNextUserStories}
          onPreviousUser={goToPreviousUserStories}
          onStoryDeleted={handleStoryDeleted}
        />
      )}
    </>
  );
};

export default StoryList;