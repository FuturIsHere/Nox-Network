// src/lib/uploadUtils.ts - SERVEUR SEULEMENT
import { rename, mkdir, unlink, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function finalizeUpload(tempFilename: string, targetType: 'posts' | 'stories' | 'messages' | 'profiles') {
  try {
    if (!tempFilename || !targetType) {
      throw new Error('Missing parameters');
    }

    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    const tempFilePath = path.join(tempDir, tempFilename);

    if (!existsSync(tempFilePath)) {
      throw new Error('Temporary file not found');
    }

    const isVideo = tempFilename.match(/\.(mp4|webm|mov|avi|mkv)$/i);
    const mediaType = isVideo ? 'videos' : 'images';
    
    // 🔥 CORRECTION : Déclarer finalFilename AVANT de l'utiliser
    const finalFilename = tempFilename.replace(/^temp_\d+_/, '');
    
    let finalDir;
    let finalUrl;
    
    if (targetType === 'messages') {
      finalDir = path.join(process.cwd(), 'public', 'uploads', 'messages', mediaType);
      finalUrl = `/uploads/messages/${mediaType}/${finalFilename}`;
    } else if (targetType === 'profiles') {
      // 🔥 NOUVEAU : Support pour les photos de profil/couverture
      finalDir = path.join(process.cwd(), 'public', 'uploads', 'profiles', mediaType);
      finalUrl = `/uploads/profiles/${mediaType}/${finalFilename}`;
    } else {
      // posts, stories
      finalDir = path.join(process.cwd(), 'public', 'uploads', mediaType);
      finalUrl = `/uploads/${mediaType}/${finalFilename}`;
    }
    
    if (!existsSync(finalDir)) {
      await mkdir(finalDir, { recursive: true });
    }

    const finalFilePath = path.join(finalDir, finalFilename);

    await rename(tempFilePath, finalFilePath);

    console.log(`✅ Fichier déplacé: ${tempFilename} → ${finalFilename} (${targetType})`);

    return {
      success: true,
      final_url: finalUrl,
      secure_url: finalUrl,
      public_id: finalFilename.split('.')[0],
      resource_type: isVideo ? 'video' : 'image',
      target_type: targetType
    };

  } catch (error) {
    console.error('Finalize upload error:', error);
    throw new Error('Failed to finalize upload');
  }
}

export async function cleanupTempFile(tempFilename: string) {
  try {
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    const tempFilePath = path.join(tempDir, tempFilename);
    
    if (existsSync(tempFilePath)) {
      await unlink(tempFilePath);
      console.log(`🗑️ Fichier temporaire supprimé: ${tempFilename}`);
      return true;
    }
    
    console.log(`⚠️ Fichier temporaire non trouvé: ${tempFilename}`);
    return false;
  } catch (error) {
    console.error('Cleanup temp file error:', error);
    return false;
  }
}

export async function cleanupOldTempFiles(maxAgeMinutes: number = 60) {
  try {
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    
    if (!existsSync(tempDir)) {
      console.log('📁 Dossier temporaire inexistant, rien à nettoyer');
      return { cleaned: 0, errors: 0, total: 0 };
    }

    const files = await readdir(tempDir);
    const now = new Date().getTime();
    const maxAge = maxAgeMinutes * 60 * 1000;
    
    let cleaned = 0;
    let errors = 0;

    console.log(`🧹 Nettoyage des fichiers temporaires (> ${maxAgeMinutes} min)...`);

    for (const file of files) {
      try {
        const filePath = path.join(tempDir, file);
        const fileStat = await stat(filePath);
        const fileAge = now - fileStat.mtime.getTime();

        if (fileAge > maxAge) {
          await unlink(filePath);
          console.log(`🗑️ Fichier temporaire ancien supprimé: ${file}`);
          cleaned++;
        }
      } catch (error) {
        console.error(`❌ Erreur suppression ${file}:`, error);
        errors++;
      }
    }

    console.log(`✅ Nettoyage terminé: ${cleaned} supprimés, ${errors} erreurs`);
    return { cleaned, errors, total: files.length };

  } catch (error) {
    console.error('Cleanup old temp files error:', error);
    return { cleaned: 0, errors: 1, total: 0 };
  }
}

export async function deleteMediaFile(mediaUrl: string) {
  try {
    if (!mediaUrl) return false;
    
    if (!mediaUrl.startsWith('/uploads/')) {
      console.log('📎 URL externe détectée, pas de suppression locale:', mediaUrl);
      return false;
    }
    
    const filePath = path.join(process.cwd(), 'public', mediaUrl);
    
    if (existsSync(filePath)) {
      await unlink(filePath);
      console.log(`🗑️ Fichier média supprimé: ${mediaUrl}`);
      return true;
    } else {
      console.log(`⚠️ Fichier non trouvé: ${mediaUrl}`);
      return false;
    }
    
  } catch (error) {
    console.error('Delete media file error:', error);
    return false;
  }
}

export async function extractFilenameFromUrl(url: string): Promise<string | null> {
  try {
    if (!url) return null;
    
    if (url.startsWith('/uploads/')) {
      return url.split('/').pop() || null;
    }
    
    const urlObj = new URL(url);
    return urlObj.pathname.split('/').pop() || null;
    
  } catch (error) {
    console.error('Extract filename error:', error);
    return null;
  }
}

// 🔥 FONCTION : Extraire le nom de fichier temporaire depuis une URL
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

// 🔥 FONCTION : Nettoyer automatiquement quand un fichier temporaire n'est plus utilisé
export async function cleanupUnusedTempFile(tempUrl: string): Promise<boolean> {
  try {
    const tempFilename = extractTempFilename(tempUrl);
    if (!tempFilename) {
      console.log('⚠️ Pas de nom de fichier temporaire extrait de:', tempUrl);
      return false;
    }

    return await cleanupTempFile(tempFilename);
  } catch (error) {
    console.error('Cleanup unused temp file error:', error);
    return false;
  }
}

// 🔥 FONCTION : Créer le dossier temporaire s'il n'existe pas
export async function ensureTempDirectory(): Promise<void> {
  try {
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
      console.log('📁 Dossier temporaire créé:', tempDir);
    }
  } catch (error) {
    console.error('Erreur création dossier temporaire:', error);
    throw new Error('Failed to create temp directory');
  }
}

// 🔥 FONCTION : Obtenir les statistiques des fichiers temporaires
export async function getTempFilesStats() {
  try {
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    
    if (!existsSync(tempDir)) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldFiles: 0,
        averageAge: 0
      };
    }

    const files = await readdir(tempDir);
    const now = new Date().getTime();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    let totalSize = 0;
    let oldFiles = 0;
    let totalAge = 0;

    for (const file of files) {
      try {
        const filePath = path.join(tempDir, file);
        const fileStat = await stat(filePath);
        
        totalSize += fileStat.size;
        totalAge += (now - fileStat.mtime.getTime());
        
        if (fileStat.mtime.getTime() < oneHourAgo) {
          oldFiles++;
        }
      } catch (error) {
        console.error(`Erreur lecture fichier ${file}:`, error);
      }
    }

    return {
      totalFiles: files.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      oldFiles,
      averageAge: files.length > 0 ? Math.round(totalAge / files.length / (1000 * 60)) : 0 // en minutes
    };
  } catch (error) {
    console.error('Erreur statistiques fichiers temporaires:', error);
    return {
      totalFiles: 0,
      totalSize: 0,
      oldFiles: 0,
      averageAge: 0
    };
  }
}