"use client"

import { useState, useRef, useEffect } from 'react';

interface VideoPlayerProps {
  src: string;
  className?: string;
  format?: 'square' | 'story'; // square = 1:1, story = 9:16
}

const VideoPlayer = ({ src, className = "", format = 'square' }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const retryCountRef = useRef(0); // Compteur de tentatives
  const isComponentMountedRef = useRef(true); // Pour éviter les mises à jour après démontage
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [componentId, setComponentId] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasLoadedFirstFrame, setHasLoadedFirstFrame] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const posterCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Generate component ID on client side only to avoid hydration mismatch
  useEffect(() => {
    setComponentId(Math.random().toString(36).substr(2, 9));
    isComponentMountedRef.current = true;
    
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  // Classes CSS pour les différents formats Instagram
  const getContainerClasses = () => {
    const baseClasses = "relative bg-black rounded-2xl overflow-hidden mx-auto";
    
    if (format === 'story') {
      return `${baseClasses} w-full max-w-[350px] aspect-[9/16]`;
    } else {
      return `${baseClasses} w-full max-w-[500px] aspect-square`;
    }
  };

  // Formatage du temps
  const formatTime = (time: number) => {
    if (!time || time < 0) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Fonction pour réinitialiser la vidéo proprement
  const resetVideoState = () => {
    if (!isComponentMountedRef.current) return;
    
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedTime(0);
    setIsLoading(false);
    setHasError(false);
    setErrorMessage('');
    
    // Nettoyer les promesses en cours
    if (playPromiseRef.current) {
      playPromiseRef.current.catch(() => {});
      playPromiseRef.current = null;
    }
  };

  // Safe play function avec compatibilité Safari
  const safePlay = async () => {
    if (!videoRef.current || hasError || !isComponentMountedRef.current) return;
    
    try {
      // Safari: vérifications spécifiques
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (isSafari) {
        // Safari nécessite parfois plus de temps pour être prêt
        if (videoRef.current.readyState < 1) {
          console.log('⏳ Safari - Vidéo pas encore prête, attente...');
          return;
        }
      } else {
        // Autres navigateurs
        if (videoRef.current.readyState < 2) {
          console.log('⏳ Vidéo pas encore prête, attente...');
          return;
        }
      }
      
      // Clear any existing play promise
      if (playPromiseRef.current) {
        await playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
      
      // Safari: gestion spéciale du play
      if (isSafari) {
        // Vérifier si la vidéo n'est pas déjà en cours de lecture
        if (!videoRef.current.paused) {
          return;
        }
        
        // Safari peut nécessiter un délai
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!isComponentMountedRef.current || !videoRef.current) return;
      }
      
      // Start new play promise
      playPromiseRef.current = videoRef.current.play();
      await playPromiseRef.current;
      playPromiseRef.current = null;
      
      // Reset retry count on successful play
      retryCountRef.current = 0;
      
    } catch (error) {
      playPromiseRef.current = null;
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        // Safari a des messages d'erreur spécifiques
        if (!errorMsg.includes('aborted') && 
            !errorMsg.includes('interrupted') && 
            !errorMsg.includes('notallowederror') &&
            !errorMsg.includes('not allowed') &&
            !errorMsg.includes('request was interrupted')) {
          console.error('Erreur lecture vidéo:', {
            message: error.message,
            name: error.name,
            src: videoRef.current?.src,
            readyState: videoRef.current?.readyState,
            retryCount: retryCountRef.current,
            browser: navigator.userAgent.includes('Safari') ? 'Safari' : 'Other'
          });
        }
      }
    }
  };

  // Safe pause function
  const safePause = async () => {
    if (!videoRef.current || !isComponentMountedRef.current) return;
    
    try {
      // Wait for any pending play promise to resolve before pausing
      if (playPromiseRef.current) {
        await playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
      
      videoRef.current.pause();
    } catch (error) {
      playPromiseRef.current = null;
      console.warn('Erreur pause vidéo:', error);
    }
  };

  // Improved play/pause toggle
  const togglePlayPause = async () => {
    if (!videoRef.current || hasError || !isComponentMountedRef.current) return;
    
    // Prevent rapid clicking
    if (playPromiseRef.current) {
      return;
    }
    
    if (isPlaying) {
      await safePause();
    } else {
      // Pause other videos first
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach(video => {
        if (video !== videoRef.current && !video.paused) {
          video.pause();
        }
      });
      
      await safePlay();
    }
  };

  // Fonction pour calculer le temps basé sur la position X
  const calculateTimeFromPosition = (clientX: number, progressElement: HTMLDivElement) => {
    const rect = progressElement.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const progressWidth = rect.width;
    
    if (progressWidth > 0) {
      const videoDuration = duration > 0 ? duration : (videoRef.current?.duration || 0);
      
      if (videoDuration > 0) {
        const percentage = Math.max(0, Math.min(1, clickX / progressWidth));
        return percentage * videoDuration;
      }
    }
    return 0;
  };

  // Gestion du clic sur la barre de progression - Compatible Safari
  const handleProgressClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!videoRef.current || hasError || !isComponentMountedRef.current) return;
    
    // Safari: vérifications supplémentaires
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Wait for any pending operations
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch (error) {
        // Ignore abort errors
      }
    }
    
    // Vérifier que la vidéo est prête (Safari plus permissif)
    const minReadyState = isSafari ? 1 : 2;
    if (videoRef.current.readyState < minReadyState) {
      console.log('⏳ Vidéo pas prête pour le seek');
      return;
    }
    
    const videoDuration = duration > 0 ? duration : videoRef.current.duration;
    
    if (videoDuration > 0) {
      const newTime = calculateTimeFromPosition(e.clientX, e.currentTarget);
      
      try {
        // Safari: éviter les seeks trop fréquents
        if (isSafari) {
          const timeDiff = Math.abs(newTime - videoRef.current.currentTime);
          if (timeDiff < 0.1) { // Éviter les micro-seeks sur Safari
            return;
          }
        }
        
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      } catch (error) {
        console.warn('Erreur changement temps vidéo:', error);
      }
    }
  };

  // Gestion du drag pour la barre de progression - Compatible Safari
  const handleProgressMouseDown = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    if (!videoRef.current || hasError || !isComponentMountedRef.current) return;
    
    // Safari: vérifications supplémentaires
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Wait for any pending operations
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch (error) {
        // Ignore abort errors
      }
    }
    
    // Vérifier que la vidéo est prête (Safari plus permissif)
    const minReadyState = isSafari ? 1 : 2;
    if (videoRef.current.readyState < minReadyState) {
      console.log('⏳ Vidéo pas prête pour le drag');
      return;
    }
    
    const videoDuration = duration > 0 ? duration : videoRef.current.duration;
    
    if (videoDuration > 0) {
      const newTime = calculateTimeFromPosition(e.clientX, e.currentTarget);
      
      try {
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      } catch (error) {
        console.warn('Erreur changement temps vidéo:', error);
      }
    }
  };

  // Gestion du mouvement de la souris pendant le drag - Compatible Safari
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && progressRef.current && videoRef.current && !hasError && isComponentMountedRef.current) {
      // Vérifier que c'est bien cette instance qui doit gérer l'événement
      const progressRect = progressRef.current.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      // Si la souris est loin de cette barre de progression, ignorer
      if (containerRect && (
        e.clientY < containerRect.top - 50 || 
        e.clientY > containerRect.bottom + 50 ||
        e.clientX < progressRect.left - 50 ||
        e.clientX > progressRect.right + 50
      )) {
        return;
      }
      
      const videoDuration = duration > 0 ? duration : (videoRef.current.duration || 0);
      
      // Safari: vérifications supplémentaires
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const minReadyState = isSafari ? 1 : 2;
      
      if (videoDuration > 0 && videoRef.current.readyState >= minReadyState) {
        const newTime = calculateTimeFromPosition(e.clientX, progressRef.current);
        
        try {
          // Safari: éviter les seeks trop fréquents pendant le drag
          if (isSafari) {
            const timeDiff = Math.abs(newTime - videoRef.current.currentTime);
            if (timeDiff < 0.2) { // Tolérance plus large pendant le drag
              setCurrentTime(newTime); // Mettre à jour l'affichage même si on ne seek pas
              return;
            }
          }
          
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        } catch (error) {
          console.warn('Erreur changement temps vidéo:', error);
        }
      }
    }
  };

  // Gestion de la fin du drag
  const handleMouseUp = (e: MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  // Event listeners globaux pour le drag
  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveInstance = (e: MouseEvent) => handleMouseMove(e);
      const handleMouseUpInstance = (e: MouseEvent) => handleMouseUp(e);
      
      document.addEventListener('mousemove', handleMouseMoveInstance, { passive: false });
      document.addEventListener('mouseup', handleMouseUpInstance);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMoveInstance);
        document.removeEventListener('mouseup', handleMouseUpInstance);
      };
    }
  }, [isDragging, duration, componentId]);

  // Gestion du volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, newVolume));
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      
      if (newMuted) {
        setVolume(0);
      } else {
        const newVolume = volume > 0 ? volume : 0.5;
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
      }
    }
  };

  // Gestion du plein écran
  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      } else {
        videoRef.current.requestFullscreen().catch(console.error);
      }
    }
  };

  // Masquer les contrôles après inactivité
  const resetControlsTimeout = () => {
    if (!isComponentMountedRef.current) return;
    
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isDragging && isComponentMountedRef.current) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Fonction pour capturer la première frame comme poster (Safari)
  const captureFirstFrame = async () => {
    if (!videoRef.current || !posterCanvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = posterCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    try {
      // Configurer le canvas aux dimensions de la vidéo
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      
      // Dessiner la frame actuelle
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      setShowPoster(true);
      setHasLoadedFirstFrame(true);
      
      console.log('📸 Première frame capturée pour Safari');
    } catch (error) {
      console.warn('Erreur capture première frame:', error);
    }
  };

  // Forcer le chargement de la première frame sur Safari
  const loadFirstFrameSafari = async () => {
    if (!videoRef.current) return;
    
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!isSafari) return;
    
    const video = videoRef.current;
    
    try {
      // Sauvegarder l'état actuel
      const wasPlaying = !video.paused;
      const currentTime = video.currentTime;
      
      // Aller au début et lire une frame
      video.currentTime = 0.1; // Légèrement après le début
      
      // Attendre que la frame soit disponible
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);
        
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          clearTimeout(timeout);
          resolve();
        };
        
        video.addEventListener('seeked', onSeeked);
      });
      
      // Capturer la frame
      await captureFirstFrame();
      
      // Restaurer l'état original
      video.currentTime = currentTime;
      
    } catch (error) {
      console.warn('Erreur chargement première frame Safari:', error);
      // Fallback: essayer de forcer l'affichage autrement
      setHasLoadedFirstFrame(true);
    }
  };
  const retryVideo = async () => {
    if (!isComponentMountedRef.current) return;
    
    console.log(`🔄 Tentative de retry #${retryCountRef.current + 1}`);
    
    retryCountRef.current++;
    
    // Réinitialiser l'état
    resetVideoState();
    setIsLoading(true);
    
    if (videoRef.current) {
      try {
        // Safari: méthode de rechargement spéciale
        const currentSrc = videoRef.current.src;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
          // Safari: forcer un nouveau chargement avec timestamp
          const separator = currentSrc.includes('?') ? '&' : '?';
          const newSrc = `${currentSrc}${separator}_t=${Date.now()}`;
          videoRef.current.src = newSrc;
          videoRef.current.load();
        } else {
          // Autres navigateurs
          videoRef.current.src = '';
          videoRef.current.load();
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (isComponentMountedRef.current) {
            videoRef.current.src = currentSrc;
            videoRef.current.load();
          }
        }
      } catch (error) {
        console.error('Erreur lors du retry:', error);
        if (isComponentMountedRef.current) {
          setIsLoading(false);
          setHasError(true);
          setErrorMessage('Impossible de recharger la vidéo');
        }
      }
    }
  };

  // Event listeners pour la vidéo avec gestion d'erreurs améliorée
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (!isComponentMountedRef.current) return;
      
      const videoDuration = video.duration || 0;
      setDuration(videoDuration);
      setIsLoading(false);
      setHasError(false);
      retryCountRef.current = 0; // Reset retry count on success
      
      console.log('✅ Vidéo chargée, durée:', videoDuration);
    };

    const handleLoadedData = () => {
      if (!isComponentMountedRef.current) return;
      setIsLoading(false);
      setHasError(false);
    };

    const handleCanPlayThrough = () => {
      if (!isComponentMountedRef.current) return;
      setIsLoading(false);
      setHasError(false);
    };

    const handleTimeUpdate = () => {
      if (!isDragging && isComponentMountedRef.current) {
        setCurrentTime(video.currentTime || 0);
      }
    };

    const handleProgress = () => {
      if (!isComponentMountedRef.current) return;
      
      if (video.buffered.length > 0) {
        try {
          setBufferedTime(video.buffered.end(video.buffered.length - 1));
        } catch (error) {
          // Ignore les erreurs de buffering
        }
      }
    };

    const handlePlay = () => {
      if (!isComponentMountedRef.current) return;
      setIsPlaying(true);
      setIsLoading(false);
      setHasError(false);
    };
    
    const handlePause = () => {
      if (!isComponentMountedRef.current) return;
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      if (!isComponentMountedRef.current) return;
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      if (!isComponentMountedRef.current) return;
      
      setIsLoading(false);
      setHasError(false);
      
      // S'assurer que la durée est définie
      if (duration <= 0 && video.duration > 0) {
        setDuration(video.duration);
        console.log('✅ Durée définie via canplay:', video.duration);
      }
    };

    const handleLoadStart = () => {
      if (!isComponentMountedRef.current) return;
      setIsLoading(true);
      setHasError(false);
    };

    // Gestion d'erreurs améliorée avec support Safari
    const handleError = async (e: Event) => {
      if (!isComponentMountedRef.current) return;
      
      const target = e.target as HTMLVideoElement;
      const error = target.error;
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      let errorMsg = 'Erreur de lecture vidéo';
      let shouldRetry = false;
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMsg = 'Lecture vidéo interrompue';
            shouldRetry = retryCountRef.current < (isSafari ? 1 : 2); // Safari plus conservateur
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = 'Erreur réseau lors du chargement de la vidéo';
            shouldRetry = retryCountRef.current < (isSafari ? 2 : 3);
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMsg = 'Erreur de décodage vidéo';
            shouldRetry = retryCountRef.current < (isSafari ? 1 : 2); // Safari sensible au décodage
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = isSafari ? 'Format vidéo non supporté par Safari' : 'Format vidéo temporairement non supporté';
            shouldRetry = retryCountRef.current < (isSafari ? 1 : 2); // Safari: retry limité
            break;
          default:
            errorMsg = `Erreur vidéo inconnue (code: ${error.code})`;
            shouldRetry = retryCountRef.current < 1;
        }
      }

      console.error('🚨 Erreur vidéo:', {
        message: errorMsg,
        code: error?.code,
        src: target.src,
        readyState: target.readyState,
        networkState: target.networkState,
        retryCount: retryCountRef.current,
        shouldRetry,
        browser: isSafari ? 'Safari' : 'Other'
      });

      setIsLoading(false);
      playPromiseRef.current = null;

      // Retry automatique avec délais adaptés à Safari
      if (shouldRetry && retryCountRef.current < 3) {
        const retryDelay = isSafari ? 2000 : 1000; // Safari: délai plus long
        console.log(`🔄 Retry automatique dans ${retryDelay/1000}s... (tentative ${retryCountRef.current + 1}/3)`);
        setTimeout(() => {
          if (isComponentMountedRef.current) {
            retryVideo();
          }
        }, retryDelay);
      } else {
        setHasError(true);
        setErrorMessage(errorMsg);
      }
    };

    // Clean up any pending promises when video ends
    const handleEnded = () => {
      if (!isComponentMountedRef.current) return;
      playPromiseRef.current = null;
      setIsPlaying(false);
    };

    // Ajout de tous les event listeners
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isDragging, duration]);

  // Réinitialiser quand la source change
  useEffect(() => {
    resetVideoState();
    retryCountRef.current = 0;
  }, [src]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      // Clear any pending play promise
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
    };
  }, []);

  // Calculer les pourcentages de manière sécurisée
  const getProgressPercentage = () => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  };

  const getBufferedPercentage = () => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (bufferedTime / duration) * 100));
  };

  return (
    <div className={`${getContainerClasses()} ${className}`}>
      <div 
        ref={containerRef}
        className="video-container relative w-full h-full"
        onMouseMove={resetControlsTimeout}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && !isDragging && setShowControls(false)}
        {...(componentId && { 'data-video-id': componentId })}
      >
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-cover"
          onClick={togglePlayPause}
          preload="metadata"
          playsInline
          controls={false}
          webkit-playsinline="true" // Safari iOS spécifique
          x-webkit-airplay="allow" // AirPlay sur Safari
          style={{ display: hasError ? 'none' : 'block' }}
        />

        {/* Message d'erreur amélioré */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
            <div className="text-center p-4">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto mb-2 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm mb-2">{errorMessage}</p>
              <p className="text-xs text-gray-400 mb-4">
                {retryCountRef.current > 0 ? `Tentatives: ${retryCountRef.current}/3` : 'Problème de lecture vidéo'}
              </p>
              <button 
                onClick={retryVideo}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 rounded text-sm transition-colors"
              >
                {isLoading ? 'Rechargement...' : 'Réessayer'}
              </button>
            </div>
          </div>
        )}

        {/* Indicateur de chargement */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        )}

        {/* Play button overlay */}
        {!isPlaying && !hasError && (
          <div 
            className="absolute inset-0 flex items-center justify-center cursor-pointer z-10"
            onClick={togglePlayPause}
          >
            <div className="bg-black/50 rounded-full p-3 hover:bg-black/70 transition-all duration-200 backdrop-blur-[9.4px]">
              <svg width="50" height="50" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}

        {/* Barre de progression en haut - Style Instagram Story */}
        {format === 'story' && !hasError && (
          <div 
            ref={progressRef}
            className="absolute top-2 left-4 right-4 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer hover:h-1.5 transition-all duration-200 z-20 select-none"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            {...(componentId && { 'data-progress-id': componentId })}
          >
            {/* Barre de buffer */}
            <div 
              className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all duration-300 pointer-events-none" 
              style={{ width: `${getBufferedPercentage()}%` }}
            />
            {/* Barre de progression */}
            <div 
              className="absolute top-0 left-0 h-full bg-white transition-all duration-100 ease-linear pointer-events-none"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        )}

        {/* Contrôles vidéo */}
        {!hasError && (
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-all duration-300 z-20 ${showControls || isDragging ? 'opacity-100' : 'opacity-0'}`}>
            
            {/* Barre de progression pour format carré */}
            {format === 'square' && (
              <div className="relative mb-4">
                <div 
                  ref={progressRef}
                  className="relative h-1 bg-white/30 backdrop-blur-[9.4px] rounded-full overflow-hidden cursor-pointer hover:h-2.5 transition-all duration-200 select-none"
                  onClick={handleProgressClick}
                  onMouseDown={handleProgressMouseDown}
                  {...(componentId && { 'data-progress-id': componentId })}
                >
                  {/* Barre de buffer */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all duration-300 pointer-events-none" 
                    style={{ width: `${getBufferedPercentage()}%` }}
                  />
                  {/* Barre de progression */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-100 ease-linear pointer-events-none" 
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                  {/* Indicateur de position */}
                  <div 
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transition-all duration-200 pointer-events-none ${isDragging || showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                    style={{ left: `calc(${getProgressPercentage()}% - 6px)` }}
                  />
                </div>
              </div>
            )}

            {/* Contrôles inférieurs */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-4">
                {/* Play/Pause */}
                <button 
                  onClick={togglePlayPause}
                  className="hover:bg-white/10 p-2 rounded-full transition-colors"
                  disabled={!!playPromiseRef.current || isLoading}
                >
                  {isPlaying ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* Volume */}
                <button 
                  onClick={toggleMute}
                  className="hover:bg-white/10 p-2 rounded-full transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                    </svg>
                  )}
                </button>

                {/* Temps */}
                <span className="text-sm font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Plein écran */}
              <button 
                onClick={toggleFullscreen}
                className="hover:bg-white/10 p-2 rounded-full transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;