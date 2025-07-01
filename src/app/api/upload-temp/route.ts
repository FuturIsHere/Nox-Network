// src/app/api/upload-temp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configuration des types de fichiers autorisés
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/mkv'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Vérifier la taille du fichier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Vérifier le type de fichier
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Créer le dossier temporaire
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Générer un nom de fichier unique avec timestamp pour éviter les conflits
    const fileExtension = path.extname(file.name);
    const tempFileName = `temp_${Date.now()}_${uuidv4()}${fileExtension}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Écrire le fichier temporaire
    const bytes = await file.arrayBuffer();
    const buffer = new Uint8Array(bytes);
    await writeFile(tempFilePath, buffer);

    // Construire l'URL temporaire
    const tempUrl = `/uploads/temp/${tempFileName}`;

    // Retourner la réponse avec les informations temporaires
    const response = {
      secure_url: tempUrl,
      temp_filename: tempFileName, // Important pour le déplacement plus tard
      public_id: tempFileName.split('.')[0],
      resource_type: isImage ? 'image' : 'video',
      format: fileExtension.slice(1),
      bytes: file.size,
      width: null,
      height: null,
      url: tempUrl,
      is_temporary: true // Flag pour indiquer que c'est temporaire
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Temp upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}