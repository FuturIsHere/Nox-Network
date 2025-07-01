// src/lib/clientUploadUtils.ts
// Fonctions côté client qui utilisent vos API routes existantes

export function extractTempFilename(tempUrl: string): string | null {
  try {
    if (!tempUrl.includes('/temp/')) {
      return null;
    }
    
    const parts = tempUrl.split('/temp/');
    if (parts.length !== 2) {
      return null;
    }
    
    return parts[1];
  } catch (error) {
    console.error('Extract temp filename error:', error);
    return null;
  }
}

export async function cleanupUnusedTempFile(tempUrl: string): Promise<boolean> {
  try {
    const tempFilename = extractTempFilename(tempUrl);
    if (!tempFilename) {
      console.log('⚠️ Pas de nom de fichier temporaire extrait de:', tempUrl);
      return false;
    }

    // Utiliser votre API route existante cleanup-temp-messages
    const response = await fetch('/api/cleanup-temp-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tempFilename }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Fichier temporaire nettoyé côté serveur:', result);
      return result.cleaned || false;
    } else {
      console.warn('⚠️ Échec nettoyage fichier temporaire côté serveur');
      return false;
    }
  } catch (error) {
    console.error('Cleanup unused temp file error:', error);
    return false;
  }
}

// Fonction utilitaire pour nettoyer via l'API cleanup-temp avec DELETE
export async function cleanupTempFileByName(tempFilename: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/cleanup-temp?filename=${encodeURIComponent(tempFilename)}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Fichier temporaire nettoyé:', result);
      return result.cleaned || false;
    } else {
      console.warn('⚠️ Échec nettoyage fichier temporaire');
      return false;
    }
  } catch (error) {
    console.error('Cleanup temp file by name error:', error);
    return false;
  }
}

// 🔥 NOUVELLES FONCTIONS pour les profils

// Vérifier si une URL est temporaire
export function isTempUrl(url: string): boolean {
  return url.includes('/temp/');
}

// Finaliser un upload depuis le côté client (pour les profils)
export async function finalizeUploadFromClient(tempUrl: string, targetType: 'posts' | 'stories' | 'messages' | 'profiles') {
  try {
    const tempFilename = extractTempFilename(tempUrl);
    if (!tempFilename) {
      throw new Error('Invalid temp URL');
    }

    console.log('🚀 [Client] Finalisation upload:', tempFilename, '→', targetType);

    const response = await fetch('/api/finalize-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tempFilename,
        targetType
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to finalize upload');
    }

    const result = await response.json();
    console.log('✅ [Client] Upload finalisé:', result.final_url);
    
    return result;
  } catch (error) {
    console.error('❌ [Client] Erreur finalisation upload:', error);
    throw error;
  }
}

// Validation côté client pour les profils
export function validateProfileImage(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  // Vérifier la taille
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Image trop volumineuse (${Math.round(file.size / 1024 / 1024)}MB). Maximum autorisé: 10MB`
    };
  }
  
  // Vérifier le type MIME
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Type d'image non autorisé: ${file.type}. Formats acceptés: JPG, PNG, GIF, WebP`
    };
  }
  
  return { valid: true };
}

// Nettoyer plusieurs fichiers temporaires
export async function cleanupMultipleTempFiles(tempUrls: string[]): Promise<number> {
  let cleaned = 0;
  
  for (const url of tempUrls) {
    if (isTempUrl(url)) {
      const success = await cleanupUnusedTempFile(url);
      if (success) cleaned++;
    }
  }
  
  console.log(`🧹 [Client] Nettoyage multiple: ${cleaned}/${tempUrls.length} fichiers supprimés`);
  return cleaned;
}