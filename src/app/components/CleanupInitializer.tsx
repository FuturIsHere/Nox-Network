"use client";

import { useEffect } from 'react';

// 🔥 COMPOSANT CLIENT : Initialise le nettoyage automatique des fichiers temporaires
export default function CleanupInitializer() {
  useEffect(() => {
    // Initialiser le nettoyage automatique seulement côté client
    if (typeof window !== 'undefined') {
      console.log('🚀 [CleanupInitializer] Initialisation du nettoyage automatique des fichiers temporaires');
      
      // Démarrer le nettoyage périodique
      const startPeriodicCleanup = () => {
        // Nettoyage immédiat au démarrage
        performCleanup();
        
        // Puis nettoyage toutes les 30 minutes
        const intervalId = setInterval(() => {
          performCleanup();
        }, 30 * 60 * 1000); // 30 minutes
        
        // Retourner la fonction de nettoyage
        return () => {
          clearInterval(intervalId);
        };
      };
      
      // Fonction de nettoyage principale
      const performCleanup = async () => {
        try {
          console.log('🧹 [CleanupInitializer] Nettoyage automatique périodique...');
          
          const response = await fetch('/api/cleanup-temp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              maxAgeMinutes: process.env.NODE_ENV === 'development' ? 120 : 60 // 2h en dev, 1h en prod
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.details && result.details.cleaned > 0) {
              console.log(`✅ [CleanupInitializer] ${result.message}`);
            }
          } else {
            console.warn('⚠️ [CleanupInitializer] Erreur nettoyage automatique:', response.status);
          }
        } catch (error) {
          console.error('❌ [CleanupInitializer] Erreur nettoyage automatique:', error);
        }
      };
      
      // Démarrer le nettoyage périodique
      const cleanup = startPeriodicCleanup();
      
      // Nettoyage manuel au changement de page/fermeture
      const handleBeforeUnload = () => {
        // Nettoyage rapide des fichiers temporaires récents (non bloquant)
        fetch('/api/cleanup-temp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxAgeMinutes: 5 }), // Nettoyer les fichiers > 5 min
          keepalive: true // Important pour que la requête se termine même si la page se ferme
        }).catch(() => {}); // Ignorer les erreurs car la page se ferme
      };

      // Nettoyage lors du changement de visibilité (onglet caché/visible)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // Quand l'utilisateur revient sur l'onglet, faire un nettoyage léger
          setTimeout(() => {
            console.log('👁️ [CleanupInitializer] Onglet redevenu visible, nettoyage léger...');
            performCleanup();
          }, 1000);
        }
      };

      // Nettoyage lors du focus de la fenêtre
      const handleFocus = () => {
        console.log('🔍 [CleanupInitializer] Fenêtre focalisée, vérification des fichiers temporaires...');
        setTimeout(performCleanup, 2000);
      };

      // Ajouter les event listeners
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      
      // Nettoyage au démontage du composant
      return () => {
        console.log('🧹 [CleanupInitializer] Nettoyage lors du démontage...');
        cleanup();
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  return null; // Ce composant ne rend rien visuellement
}