import React, { useState, useRef, useEffect } from 'react';
import { Trash2, MoreHorizontal } from 'lucide-react';
import Image from "next/image"
import VideoPlayer from '../components/feed/VideoPlayer';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO';
  mediaUrl?: string | null;
}

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  onDeleteMessage: (messageId: string) => Promise<void>;
  showTimestamp?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  currentUserId, 
  onDeleteMessage,
  showTimestamp = false 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMoreButton, setShowMoreButton] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      
      if (dropdownRef.current && !dropdownRef.current.contains(target) &&
          messageRef.current && !messageRef.current.contains(target) &&
          (!moreButtonRef.current || !moreButtonRef.current.contains(target))) {
        setShowDropdown(false);
        setShowMoreButton(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchend', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, []);

  const formatDetailedTimestamp = (dateString: string) => {
    const messageDate = new Date(dateString);
    
    const dayName = messageDate.toLocaleDateString('en-US', { weekday: 'short' });
    const timeFormat = messageDate.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `${dayName} ${timeFormat}`;
  };

  const formatMessageTimestamp = (dateString: string) => {
    const messageDate = new Date(dateString);
    const now = new Date();
    
    const diffTime = now.getTime() - messageDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const isToday = now.toDateString() === messageDate.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = yesterday.toDateString() === messageDate.toDateString();
    
    const timeFormat = messageDate.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (isToday) {
      return timeFormat;
    } else if (isYesterday) {
      return `Yesterday ${timeFormat}`;
    } else if (diffDays <= 6) {
      const dayName = messageDate.toLocaleDateString('en-US', { weekday: 'long' });
      return `${dayName} ${timeFormat}`;
    } else {
      const dayMonth = messageDate.toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      return `${dayMonth} ${timeFormat}`;
    }
  };

  // Gestion unifiée des interactions
  const handleMessageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isOwnMessage) {
      // Pour ses propres messages : afficher le bouton "more" 
      setShowMoreButton(true);
      setShowDropdown(false);
    } else {
      // Pour les messages reçus : afficher directement le dropdown avec la date
      setShowDropdown(!showDropdown);
      setShowMoreButton(false);
    }
  };

  const handleMouseEnter = () => {
    // Comportement hover uniquement sur desktop
    if (!isMobile) {
      if (isOwnMessage) {
        setShowMoreButton(true);
      } else {
        setShowDropdown(true);
      }
    }
  };

  const handleMouseLeave = () => {
    // Comportement hover uniquement sur desktop
    if (!isMobile) {
      if (isOwnMessage) {
        setShowMoreButton(false);
      } else {
        setShowDropdown(false);
      }
    }
  };

  const handleMoreButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleDeleteMessage = async () => {
    setIsDeleting(true);
    try {
      await onDeleteMessage(message.id);
      setShowDropdown(false);
      setShowMoreButton(false);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du message');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderMediaContent = () => {
    if (!message.mediaUrl) return null;

    const commonClasses = "max-w-xs rounded-lg overflow-hidden mb-2";

    switch (message.type) {
      case 'IMAGE':
        return (
          <div className={`${commonClasses} relative group`}>
            {!imageError ? (
              <Image
                src={message.mediaUrl}
                alt="Image partagée"
                width={300}
                height={200}
                className="w-full h-auto object-cover rounded-lg"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-32 bg-gray-200 flex items-center justify-center rounded-lg">
                <span className="text-gray-500 text-sm">Image non disponible</span>
              </div>
            )}
          </div>
        );

      case 'VIDEO':
        return (
          <div className={`${commonClasses} relative group`}>
            <VideoPlayer 
              src={message.mediaUrl} 
              format="square"
              className="max-w-xs rounded-lg"
            />
          </div>
        );

      default:
        return null;
    }
  };

  const isOwnMessage = message.senderId === currentUserId;

  return (
    <>
      {/* Timestamp partagé */}
      {showTimestamp && (
        <div className="flex justify-center my-4">
          <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
            {formatMessageTimestamp(message.createdAt)}
          </span>
        </div>
      )}
      
      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} relative`}>
        <div className="relative flex items-center">
          {/* Bouton "More" - affiché à gauche des messages envoyés quand nécessaire */}
          {isOwnMessage && showMoreButton && (
            <button
              ref={moreButtonRef}
              onClick={handleMoreButtonClick}
              className="mr-2 p-2 hover:bg-gray-200 rounded-full transition-colors duration-150"
            >
              <Image 
                className="cursor-pointer" 
                width={20} 
                height={20} 
                src="/more.png" 
                alt="Options" 
              />
            </button>
          )}

          {/* Container du message */}
          <div
            ref={messageRef}
            className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl cursor-pointer relative group ${
              isOwnMessage
                ? 'bg-blue-500 text-white rounded-br-sm'
                : 'bg-[#e9e9eb] text-black rounded-bl-sm'
            } ${isDeleting ? 'opacity-50' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleMessageClick}
          >
            {/* Contenu média */}
            {message.mediaUrl && renderMediaContent()}

            {/* Contenu texte */}
            {message.content && (
              <p className="text-sm leading-relaxed">{message.content}</p>
            )}

            {/* Dropdown unifié - positionné de manière cohérente */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                className={`absolute z-30 bg-white rounded-2xl shadow-xl min-w-[140px] overflow-hidden
                  ${isOwnMessage 
                    ? 'bottom-full mb-2 right-0' // Messages envoyés : au-dessus, aligné à droite
                    : 'bottom-full mb-2 left-0'  // Messages reçus : au-dessus, aligné à gauche
                  }`}
                style={{
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                }}
              >
                {/* Section Timestamp */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-sm text-gray-600 font-medium text-center">
                    {formatDetailedTimestamp(message.createdAt)}
                  </p>
                </div>
                
                {/* Section Actions (seulement pour ses propres messages) */}
                {isOwnMessage && (
                  <div className="py-1">
                    <button
                      onClick={handleDeleteMessage}
                      disabled={isDeleting}
                      className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 disabled:opacity-50 transition-colors duration-150"
                    >
                      <Trash2 size={16} />
                      {isDeleting ? 'Suppression...' : 'Retirer'}
                    </button>
                  </div>
                )}
                
                {/* Flèche pointant vers le message */}
                <div className={`absolute top-full w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-transparent border-t-white 
                  ${isOwnMessage ? 'right-6' : 'left-6'}`}>
                </div>
              </div>
            )}

            {/* Indicateur visuel mobile pour montrer l'interactivité */}
            {isMobile && (
              <div className={`absolute top-1 ${isOwnMessage ? 'left-1' : 'right-1'} opacity-0 group-active:opacity-30 transition-opacity`}>
                <div className="w-2 h-2 bg-current rounded-full"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export { MessageItem };