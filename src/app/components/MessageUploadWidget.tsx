"use client"

import React, { useState, useRef } from 'react';
import { X, Upload, Image, Video } from 'lucide-react';

interface MessageUploadWidgetProps {
  onUploadComplete: (mediaUrl: string) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
  children: React.ReactNode; // Le bouton déclencheur
}

const MessageUploadWidget: React.FC<MessageUploadWidgetProps> = ({
  onUploadComplete,
  onUploadStart,
  onUploadError,
  disabled = false,
  children
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/mkv'];
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  const handleFileSelect = async (file: File) => {
    // Vérifications
    if (file.size > MAX_FILE_SIZE) {
      onUploadError?.('Le fichier est trop volumineux (max 100MB)');
      return;
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      onUploadError?.('Type de fichier non supporté');
      return;
    }

    // Créer une prévisualisation locale
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setPreviewType(isImage ? 'image' : 'video');
    setShowPreview(true);
    setIsUploading(true);
    onUploadStart?.();

    console.log('📤 [MessageUpload] Début upload temporaire...', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    try {
      // 🔥 MODIFIÉ : Upload vers le dossier temporaire uniquement
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-temp', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      console.log('✅ [MessageUpload] Upload temporaire réussi:', {
        tempUrl: result.secure_url,
        tempFilename: result.temp_filename,
        isTemporary: result.is_temporary
      });

      // 🔥 IMPORTANT : Passer l'URL temporaire directement
      // Le fichier sera finalisé seulement lors de l'envoi du message
      onUploadComplete(result.secure_url);
      setShowPreview(false);
      
    } catch (error) {
      console.error('❌ [MessageUpload] Erreur upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur d\'upload';
      onUploadError?.(errorMessage);
      setShowPreview(false);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Nettoyer la prévisualisation locale
      URL.revokeObjectURL(localPreviewUrl);
    }
  };

  const handleButtonClick = () => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset l'input pour permettre de sélectionner le même fichier
    e.target.value = '';
  };

  const cancelUpload = () => {
    setShowPreview(false);
    setIsUploading(false);
    setUploadProgress(0);
    
    // Nettoyer la prévisualisation locale
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    console.log('❌ [MessageUpload] Upload annulé par l\'utilisateur');
  };

  return (
    <>
      <div onClick={handleButtonClick} className="cursor-pointer">
        {children}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Modal de prévisualisation pendant l'upload */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">
                {isUploading ? 'Upload en cours...' : 'Upload terminé'}
              </h3>
              <button
                onClick={cancelUpload}
                className="p-1 hover:bg-gray-100 rounded-full"
                disabled={isUploading}
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenu */}
            <div className="p-4">
              {/* Prévisualisation */}
              <div className="relative mb-4">
                {previewType === 'image' ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                ) : (
                  <video
                    src={previewUrl}
                    className="w-full h-64 object-cover rounded-lg"
                    controls
                    muted
                  />
                )}

                {/* Overlay de chargement */}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p className="text-sm">Préparation du fichier...</p>
                      <p className="text-xs mt-1 opacity-75">Fichier temporaire</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Barre de progression simulée */}
              {isUploading && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                    style={{ width: '70%' }}
                  ></div>
                </div>
              )}

              {/* Info fichier */}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                  {previewType === 'image' ? <Image size={16} /> : <Video size={16} />}
                  <span>
                    {previewType === 'image' ? 'Image' : 'Vidéo'} temporaire
                  </span>
                </div>
                
                {!isUploading && (
                  <span className="text-green-600 text-xs font-medium">
                    ✓ Prêt à envoyer
                  </span>
                )}
              </div>

              {/* Message informatif */}
              {!isUploading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    💡 Le fichier sera finalisé lors de l'envoi du message. 
                    Il sera automatiquement supprimé si vous annulez.
                  </p>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex gap-2 mt-4">
                {!isUploading && (
                  <>
                    <button
                      onClick={cancelUpload}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Continuer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageUploadWidget;