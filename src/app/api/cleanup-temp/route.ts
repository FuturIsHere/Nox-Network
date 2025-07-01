// src/app/api/cleanup-temp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldTempFiles, cleanupTempFile } from '@/lib/uploadUtils';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Route pour nettoyer automatiquement les fichiers temporaires anciens
// Peut être appelée par un cron job ou manuellement
export async function POST(request: NextRequest) {
  try {
    // Récupérer l'âge maximal depuis le body (optionnel)
    const body = await request.json().catch(() => ({}));
    const maxAgeMinutes = body.maxAgeMinutes || 60; // Par défaut 1 heure

    console.log(`🧹 [CleanupCron] Début nettoyage automatique (fichiers > ${maxAgeMinutes} min)`);

    const result = await cleanupOldTempFiles(maxAgeMinutes);

    console.log(`✅ [CleanupCron] Nettoyage terminé:`, result);

    return NextResponse.json({
      success: true,
      message: `Nettoyage terminé: ${result.cleaned} fichiers supprimés`,
      details: result
    });

  } catch (error) {
    console.error('❌ [CleanupCron] Erreur:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to cleanup temp files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Route GET pour vérifier le statut des fichiers temporaires
export async function GET() {
  try {
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    
    if (!existsSync(tempDir)) {
      return NextResponse.json({
        success: true,
        totalFiles: 0,
        oldFiles: 0,
        totalSize: 0,
        message: 'Dossier temporaire vide ou inexistant'
      });
    }

    const files = await readdir(tempDir);
    const now = new Date().getTime();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    let totalSize = 0;
    let oldFiles = 0;
    const fileDetails = [];

    for (const file of files) {
      try {
        const filePath = path.join(tempDir, file);
        const fileStat = await stat(filePath);
        totalSize += fileStat.size;
        
        const age = now - fileStat.mtime.getTime();
        const ageMinutes = Math.floor(age / (1000 * 60));
        
        if (fileStat.mtime.getTime() < oneHourAgo) {
          oldFiles++;
        }

        fileDetails.push({
          name: file,
          size: fileStat.size,
          ageMinutes,
          isOld: ageMinutes > 60,
          createdAt: fileStat.mtime.toISOString()
        });
      } catch (error) {
        console.error(`Erreur lecture fichier ${file}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      totalFiles: files.length,
      oldFiles,
      totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      message: `${files.length} fichiers temporaires, ${oldFiles} anciens (>1h)`,
      files: fileDetails.slice(0, 10) // Limiter à 10 fichiers pour éviter des réponses trop lourdes
    });

  } catch (error) {
    console.error('❌ [CleanupCron] Erreur status:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to get temp files status'
    }, { status: 500 });
  }
}

// Route DELETE pour nettoyer un fichier temporaire spécifique
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tempFilename = searchParams.get('filename');
    
    if (!tempFilename) {
      return NextResponse.json({ 
        error: 'Filename required in query parameter' 
      }, { status: 400 });
    }

    console.log(`🗑️ [CleanupTemp] Suppression fichier spécifique: ${tempFilename}`);

    const cleaned = await cleanupTempFile(tempFilename);

    if (cleaned) {
      console.log(`✅ [CleanupTemp] Fichier supprimé: ${tempFilename}`);
      return NextResponse.json({ 
        success: true, 
        cleaned: true,
        filename: tempFilename,
        message: 'Fichier temporaire supprimé avec succès'
      });
    } else {
      console.log(`⚠️ [CleanupTemp] Fichier non trouvé: ${tempFilename}`);
      return NextResponse.json({ 
        success: true, 
        cleaned: false,
        filename: tempFilename,
        message: 'Fichier temporaire non trouvé'
      });
    }

  } catch (error) {
    console.error('❌ [CleanupTemp] Erreur suppression:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to delete temp file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Route PATCH pour forcer le nettoyage de tous les fichiers temporaires (dangereux)
export async function PATCH(request: NextRequest) {
  try {
    // Vérification de sécurité - seulement en développement
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        error: 'Force cleanup not allowed in production' 
      }, { status: 403 });
    }

    console.log(`🚨 [CleanupTemp] FORCE: Nettoyage de TOUS les fichiers temporaires`);

    // Forcer le nettoyage de tous les fichiers (âge = 0)
    const result = await cleanupOldTempFiles(0);

    console.log(`✅ [CleanupTemp] FORCE: Nettoyage terminé:`, result);

    return NextResponse.json({
      success: true,
      message: `Force cleanup: ${result.cleaned} fichiers supprimés`,
      details: result,
      warning: 'Tous les fichiers temporaires ont été supprimés'
    });

  } catch (error) {
    console.error('❌ [CleanupTemp] Erreur force cleanup:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to force cleanup temp files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}