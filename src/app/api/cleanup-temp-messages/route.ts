// app/api/cleanup-temp-messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cleanupTempFile } from '@/lib/uploadUtils';

// Cette route permet de nettoyer un fichier temporaire spécifique
// Utile quand l'utilisateur annule l'upload ou ferme la conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempFilename } = body;

    if (!tempFilename) {
      return NextResponse.json({ 
        error: 'tempFilename is required',
        success: false 
      }, { status: 400 });
    }

    console.log('🗑️ [CleanupTempMessages] Nettoyage fichier temporaire:', tempFilename);

    const cleaned = await cleanupTempFile(tempFilename);

    if (cleaned) {
      console.log('✅ [CleanupTempMessages] Fichier temporaire supprimé avec succès');
      return NextResponse.json({ 
        success: true, 
        cleaned: true,
        filename: tempFilename,
        message: 'Fichier temporaire supprimé avec succès'
      });
    } else {
      console.log('⚠️ [CleanupTempMessages] Fichier temporaire non trouvé');
      return NextResponse.json({ 
        success: true, 
        cleaned: false,
        filename: tempFilename,
        message: 'Fichier temporaire non trouvé (peut-être déjà supprimé)'
      });
    }

  } catch (error) {
    console.error('❌ [CleanupTempMessages] Erreur:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to cleanup temp file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 🔥 AJOUT : Route GET pour vérifier si un fichier temporaire existe
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tempFilename = searchParams.get('filename');
    
    if (!tempFilename) {
      return NextResponse.json({ 
        error: 'filename parameter is required' 
      }, { status: 400 });
    }

    const { existsSync } = await import('fs');
    const path = await import('path');
    
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    const tempFilePath = path.join(tempDir, tempFilename);
    
    const exists = existsSync(tempFilePath);

    return NextResponse.json({
      exists,
      filename: tempFilename,
      message: exists ? 'Fichier temporaire existe' : 'Fichier temporaire non trouvé'
    });

  } catch (error) {
    console.error('❌ [CleanupTempMessages] Erreur vérification:', error);
    return NextResponse.json({ 
      error: 'Failed to check temp file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Route pour nettoyer tous les fichiers temporaires anciens (optionnel)
export async function DELETE() {
  try {
    const { cleanupOldTempFiles } = await import('@/lib/uploadUtils');
    
    const result = await cleanupOldTempFiles();
    
    return NextResponse.json({
      success: true,
      message: `Nettoyage global: ${result.cleaned} fichiers supprimés`,
      details: result
    });
  } catch (error) {
    console.error('❌ [CleanupTempMessages] Erreur nettoyage global:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to cleanup old temp files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}