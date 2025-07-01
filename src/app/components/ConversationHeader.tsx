import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Info, Trash2, MoreHorizontal, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  name?: string | null;
  surname?: string | null;
  avatar?: string | null;
}

// Interface unifiée pour supporter les deux formats
interface ConversationData {
  id: string;
  otherUser: User;
  isOnline: boolean;
}

interface ConversationHeaderProps {
  // Support pour les deux formats
  selectedChat?: ConversationData;
  conversation?: ConversationData;
  onlineUsers: string[];
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onBack?: () => void; // Pour mobile
  isMobile?: boolean;
}

// Composant de modale intégré
interface DeleteConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  otherUserName: string;
  isDeleting: boolean;
}

const DeleteConversationModal: React.FC<DeleteConversationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  otherUserName,
  isDeleting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Supprimer la conversation
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-4 leading-relaxed">
            Êtes-vous sûr de vouloir supprimer votre conversation avec{' '}
            <span className="font-medium text-gray-900">{otherUserName}</span> ?
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Cette action :</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Supprimera la conversation de votre liste</li>
                  <li>• N'affectera pas la conversation de {otherUserName}</li>
                  <li>• Peut être annulée en envoyant un nouveau message</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-6 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Suppression...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Supprimer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  selectedChat,
  conversation,
  onlineUsers,
  onDeleteConversation,
  onBack,
  isMobile = false
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Utiliser soit selectedChat soit conversation (compatibilité avec les deux formats)
  const chatData = selectedChat || conversation;

  if (!chatData) {
    console.error('ConversationHeader: Ni selectedChat ni conversation n\'ont été fournis');
    return null;
  }

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteClick = () => {
    setShowDropdown(false);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDeleteConversation(chatData.id);
      setShowDeleteModal(false);
      // La redirection sera gérée par le parent
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de la conversation');
    } finally {
      setIsDeleting(false);
    }
  };

  const getUserDisplayName = (user: User) => {
    return (user.name && user.surname) ? `${user.name} ${user.surname}` : user.username;
  };

  const isUserOnline = chatData.isOnline || onlineUsers.includes(chatData.otherUser.id);

  return (
    <>
      <div className={`bg-white border-b border-gray-200 rounded-t-[30px] p-4 flex items-center ${isMobile ? '' : 'justify-between'} `}>
        <div className="flex items-center flex-1">
          {/* Bouton retour sur mobile */}
          {isMobile && onBack && (
            <button
              onClick={onBack}
              className="mr-3 p-1"
            >
              <ArrowLeft size={24} />
            </button>
          )}

          {/* Avatar et infos utilisateur */}
          <div className="relative">
            <Link href={`/profile/${chatData.otherUser.username}`}>
            <img
              src={chatData.otherUser.avatar || '/noAvatar.png'}
              alt={getUserDisplayName(chatData.otherUser)}
              className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover`}
            />
            </Link>
            {isUserOnline && (
              <div className={`absolute bottom-0 right-0 ${isMobile ? 'w-3 h-3' : 'w-3 h-3'} bg-green-500 rounded-full border border-white`}></div>
            )}
          </div>
          
          <div className="ml-3">
            <Link href={`/profile/${chatData.otherUser.username}`}>
            <h2 className={`font-medium text-gray-900 ${isMobile ? 'text-base' : 'text-lg'}`}>
              {getUserDisplayName(chatData.otherUser)}
            </h2>
            <p className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              @{chatData.otherUser.username}
            </p>
            </Link>
          </div>
        </div>

        {/* Bouton Menu avec dropdown */}
        <div className="relative flex items-center gap-2">
          <button
            ref={buttonRef}
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-150"
          >
            {isMobile ? <MoreHorizontal size={20} /> : <Info size={20} />}
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl z-30 min-w-[200px] overflow-hidden"
              style={{
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* Section Informations (optionnel) */}
              <div className="py-1 border-b border-gray-100">
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={chatData.otherUser.avatar || '/noAvatar.png'}
                      alt={getUserDisplayName(chatData.otherUser)}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getUserDisplayName(chatData.otherUser)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        @{chatData.otherUser.username}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Actions */}
              <div className="py-1">
                <button
                  onClick={handleDeleteClick}
                  className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors duration-150"
                >
                  <Trash2 size={16} />
                  Supprimer la conversation
                </button>
              </div>
              
              {/* Petite flèche pointant vers le bouton */}
              <div className="absolute -top-2 right-6 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-transparent border-b-white"></div>
            </div>
          )}
        </div>
      </div>

      {/* Modale de confirmation de suppression */}
      <DeleteConversationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        otherUserName={getUserDisplayName(chatData.otherUser)}
        isDeleting={isDeleting}
      />
    </>
  );
};

export { ConversationHeader };