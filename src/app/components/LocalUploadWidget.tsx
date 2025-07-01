// src/components/LocalUploadWidget.tsx - Version avec upload temporaire
"use client";

import { useRef, ChangeEvent } from 'react';

interface LocalUploadWidgetProps {
  onSuccess: (result: any) => void;
  onError?: (error: any) => void;
  options?: {
    multiple?: boolean;
    resourceType?: 'image' | 'video' | 'auto';
    maxFileSize?: number;
    sources?: string[];
    clientAllowedFormats?: string[];
  };
  children: ({ open }: { open: () => void }) => React.ReactNode;
}

const LocalUploadWidget = ({
  onSuccess,
  onError,
  options = {},
  children
}: LocalUploadWidgetProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Vérifier la taille du fichier si spécifiée
      if (options.maxFileSize && file.size > options.maxFileSize) {
        throw new Error('File too large');
      }

      // Vérifier le type de fichier
      if (options.resourceType) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (options.resourceType === 'image' && !isImage) {
          throw new Error('Only images are allowed');
        }
        if (options.resourceType === 'video' && !isVideo) {
          throw new Error('Only videos are allowed');
        }
      }

      // Vérifier les formats autorisés
      if (options.clientAllowedFormats) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !options.clientAllowedFormats.includes(fileExtension)) {
          throw new Error('File format not allowed');
        }
      }

      // Créer FormData et uploader vers le dossier temporaire
      const formData = new FormData();
      formData.append('file', file);

      console.log('📁 Upload vers dossier temporaire...');

      const response = await fetch('/api/upload-temp', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      console.log('✅ Fichier temporaire créé:', result);

      // 🔥 CORRECTION : Appeler onSuccess avec la structure attendue
      onSuccess({
        info: result // Maintenant result contient déjà secure_url, temp_filename, etc.
      });

    } catch (error) {
      console.error('Upload error:', error);
      if (onError) {
        onError(error);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Construire l'attribut accept basé sur les options
  let acceptAttribute = '';
  if (options.resourceType === 'image') {
    acceptAttribute = 'image/*';
  } else if (options.resourceType === 'video') {
    acceptAttribute = 'video/*';
  } else if (options.clientAllowedFormats) {
    acceptAttribute = options.clientAllowedFormats.map(format => `.${format}`).join(',');
  } else {
    acceptAttribute = 'image/*,video/*';
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttribute}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        multiple={options.multiple || false}
      />
      {children({ open: openFileDialog })}
    </>
  );
};

export default LocalUploadWidget;