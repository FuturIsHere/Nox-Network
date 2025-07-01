// lib/cleanupScheduler.ts
// Système de nettoyage automatique des fichiers temporaires

class CleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Démarre le nettoyage automatique périodique
   * @param intervalMinutes Intervalle en minutes entre chaque nettoyage (défaut: 30 min)
   * @param maxAgeMinutes Âge maximum des fichiers à garder (défaut: 60 min)
   */
  start(intervalMinutes: number = 30, maxAgeMinutes: number = 60) {
    if (this.isRunning) {
      console.log('🔄 [CleanupScheduler] Déjà démarré');
      return;
    }

    console.log(`🚀 [CleanupScheduler] Démarrage du nettoyage automatique (toutes les ${intervalMinutes} min)`);
    
    this.isRunning = true;
    
    // Nettoyage immédiat au démarrage
    this.performCleanup(maxAgeMinutes);
    
    // Programmer les nettoyages périodiques
    this.intervalId = setInterval(() => {
      this.performCleanup(maxAgeMinutes);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Arrête le nettoyage automatique
   */
  stop() {
    if (!this.isRunning) {
      console.log('⏹️ [CleanupScheduler] Déjà arrêté');
      return;
    }

    console.log('🛑 [CleanupScheduler] Arrêt du nettoyage automatique');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
  }

  /**
   * Effectue un nettoyage immédiat
   */
  async performCleanup(maxAgeMinutes: number = 60) {
    try {
      console.log(`🧹 [CleanupScheduler] Nettoyage automatique en cours...`);
      
      const response = await fetch('/api/cleanup-temp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxAgeMinutes }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ [CleanupScheduler] ${result.message}`);
      } else {
        console.error('❌ [CleanupScheduler] Erreur HTTP:', response.status);
      }
    } catch (error) {
      console.error('❌ [CleanupScheduler] Erreur nettoyage:', error);
    }
  }

  /**
   * Retourne le statut du scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null
    };
  }
}

// Instance singleton du scheduler
export const cleanupScheduler = new CleanupScheduler();

// Fonction d'initialisation à appeler au démarrage de l'application
export function initializeCleanupScheduler() {
  // Démarrer le nettoyage automatique seulement en production
  if (process.env.NODE_ENV === 'production') {
    cleanupScheduler.start(30, 60); // Toutes les 30 min, fichiers > 1h
  } else {
    // En développement, nettoyage moins fréquent
    cleanupScheduler.start(60, 120); // Toutes les 60 min, fichiers > 2h
  }
}

// Fonction de nettoyage manuel pour les composants
export async function manualCleanup(tempUrl: string): Promise<boolean> {
  try {
    if (!tempUrl.includes('/temp/')) {
      return false;
    }

    const tempFilename = tempUrl.split('/temp/')[1];
    
    const response = await fetch('/api/cleanup-temp-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tempFilename }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ [ManualCleanup] Fichier nettoyé:', tempFilename);
      return result.cleaned;
    } else {
      console.warn('⚠️ [ManualCleanup] Échec nettoyage:', tempFilename);
      return false;
    }
  } catch (error) {
    console.error('❌ [ManualCleanup] Erreur:', error);
    return false;
  }
}