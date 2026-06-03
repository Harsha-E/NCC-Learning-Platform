import { getDbInstance, doc, getDoc } from "../core/firebase-init.js";
import Store from "../core/store.js";
import ContentService from "./content.service.js";
import db from "./DexieStore.js";
import { SyncEngine } from "./SyncEngine.js";
import AnalyticsService from "./AnalyticsService.js";

// ==========================================
// PROGRESS SERVICE CORE
// ==========================================
export default class ProgressService {
  
  /**
   * One-time Bootstrap to fetch data from Firestore and store it in Dexie.
   * Call this ONCE during login.
   */
  static async syncUserProgress(uid) {
    if (!uid || !navigator.onLine) return;
    try {
      const firestore = getDbInstance();
      const snap = await getDoc(doc(firestore, 'progress', uid));
      let data = snap.exists() ? snap.data() : { modules: {} };
      
      await db.progress.put({
          userId: uid,
          lastUpdated: Date.now(),
          data: data
      });
      console.log('✅ Local Dexie cache bootstrapped from Firestore.');
    } catch (e) {
      console.error("Bootstrap sync failed:", e);
    }
  }

  static async queueWrite(path, data) {
    await SyncEngine.queueUp(path, data);
  }

  static async flushQueue() {
    await SyncEngine.flushQueue();
  }

  /**
   * 100% Dexie-Only Read. No Firestore fallbacks.
   * Eliminates read spikes for 13,000 cadets.
   */
  static async getUserProgress(uid) {
    if (!uid) return { modules: {} };
    
    try {
      let localRecord = await db.progress.get(uid);
      
      if (!localRecord || !localRecord.data) {
          // Absolute fallback, meaning bootstrap hasn't run yet.
          localRecord = { userId: uid, data: { modules: {} } };
      }
      
      Store.set('userProgress', localRecord.data);
      return localRecord.data;
    } catch (error) {
      console.warn("Progress Service Local Error:", error);
      return Store.get('userProgress') || { modules: {} };
    }
  }

  static async getProgress(uid) {
      return this.getUserProgress(uid);
  }

  static async getModuleProgress(uid, moduleId) {
      const progress = await this.getUserProgress(uid);
      if (progress && progress.modules && progress.modules[moduleId]) {
          return progress.modules[moduleId];
      }
      return { overallPercent: 0, chaptersCompleted: 0, chaptersRead: {}, quizzes: {} };
  }

  static async updateChapterScroll(uid, moduleId, chapterId, percent) {
    if (!uid) return;
    
    let progress = Store.get('userProgress') || { modules: {} };
    
    if (!progress.modules) progress.modules = {};
    if (!progress.modules[moduleId]) progress.modules[moduleId] = { overallPercent: 0, chaptersCompleted: 0, chaptersRead: {} };
    if (!progress.modules[moduleId].chaptersRead) progress.modules[moduleId].chaptersRead = {};
    
    const currentPercent = progress.modules[moduleId].chaptersRead[chapterId]?.percentScrolled || 0;
    const maxPercent = Math.max(percent, currentPercent);
    
    if (maxPercent > currentPercent) {
      const timestamp = new Date().toISOString();
      const isCompleted = maxPercent >= 90;
      progress.modules[moduleId].chaptersRead[chapterId] = { percentScrolled: maxPercent, lastAccessed: timestamp, completed: isCompleted };
      
      Store.set('userProgress', progress);
      
      const payload = {
          modules: {
              [moduleId]: {
                  chaptersRead: {
                      [chapterId]: { percentScrolled: maxPercent, lastAccessed: timestamp, completed: isCompleted }
                  }
              }
          }
      };
      await this.queueWrite(`progress/${uid}`, payload);

      if (isCompleted && currentPercent < 90) {
          const profile = Store.get('profile') || {};
          AnalyticsService.trackEvent('chapter_read', { moduleId, chapterId });
          await this.markChapterRead(uid, profile.certificate || 'A', moduleId, chapterId);
      }
    }
  }

  static async markChapterRead(uid, certId, moduleId, chapterId) {
    if (!uid) return;
    try {
        const chapters = await ContentService.getChapters(certId, moduleId);
        const totalChapters = chapters.length || 1;
        
        let progress = Store.get('userProgress') || { modules: {} };
        const modProgress = progress.modules?.[moduleId]?.chaptersRead || {};
        
        let completedCount = 0;
        Object.keys(modProgress).forEach(key => {
            if (modProgress[key].percentScrolled >= 90 || modProgress[key].completed) completedCount++;
        });

        const overallPercent = Math.round((completedCount / totalChapters) * 100);
        
        if (!progress.modules[moduleId]) progress.modules[moduleId] = {};
        progress.modules[moduleId].chaptersCompleted = completedCount;
        progress.modules[moduleId].overallPercent = overallPercent;
        Store.set('userProgress', progress);

        const payload = { 
            modules: { 
                [moduleId]: { 
                    chaptersCompleted: completedCount, 
                    overallPercent: overallPercent 
                } 
            } 
        };
        await this.queueWrite(`progress/${uid}`, payload);

        if (overallPercent >= 100 && progress.modules[moduleId].chaptersCompleted === totalChapters && !progress.modules[moduleId].courseCompletedEventSent) {
            progress.modules[moduleId].courseCompletedEventSent = true;
            Store.set('userProgress', progress);
            AnalyticsService.trackEvent('course_completed', { moduleId, certId });
        }
    } catch (e) {}
  }

  static async saveQuizResult(uid, moduleId, chapterId, resultData) {
      if (!uid) return;

      let progress = Store.get('userProgress') || { modules: {} };
      
      if (!progress.modules) progress.modules = {};
      if (!progress.modules[moduleId]) progress.modules[moduleId] = {};
      if (!progress.modules[moduleId].quizzes) progress.modules[moduleId].quizzes = {};
      
      const timestamp = new Date().toISOString();
      const existing = progress.modules[moduleId].quizzes[chapterId] || {};
      
      const isPassed = existing.passed === true ? true : (resultData.passed === true);
      const bestScore = Math.max(resultData.score || 0, existing.bestScore || 0);
      const attempts = (existing.attempts || 0) + 1;

      const newRecord = {
          ...resultData,
          bestScore,
          attempts,
          passed: isPassed,
          lastAttemptAt: timestamp
      };

      progress.modules[moduleId].quizzes[chapterId] = newRecord;
      Store.set('userProgress', progress);
      
      if (isPassed && !existing.passed) {
          AnalyticsService.trackEvent('quiz_passed', { moduleId, chapterId, score: resultData.score });
      }
      
      const payload = { 
          modules: { 
              [moduleId]: { 
                  quizzes: { 
                      [chapterId]: newRecord 
                  } 
              } 
          } 
      };
      await this.queueWrite(`progress/${uid}`, payload);
  }
  
  static async getDashboardStats(uid, modules) {
      const progress = await this.getUserProgress(uid);
      
      let totalMods = modules.length || 1;
      let modsCompleted = 0;
      let totalQuizScore = 0;
      let totalQuizzesTaken = 0;
      let totalCoursePct = 0;

      if (progress && progress.modules) {
          Object.keys(progress.modules).forEach(modId => {
              const mod = progress.modules[modId];
              if (mod.overallPercent >= 100) modsCompleted++;
              totalCoursePct += (mod.overallPercent || 0);

              if (mod.quizzes) {
                  Object.keys(mod.quizzes).forEach(quizId => {
                      totalQuizScore += (mod.quizzes[quizId].bestScore || 0);
                      totalQuizzesTaken++;
                  });
              }
          });
      }

      const averageAccuracy = totalQuizzesTaken > 0 ? Math.round(totalQuizScore / totalQuizzesTaken) : 0;
      const overallPercent = Math.round(totalCoursePct / totalMods) || 0;

      return {
          modulesCompleted: modsCompleted,
          overallPercent: overallPercent > 100 ? 100 : overallPercent,
          averageAccuracy: averageAccuracy
      };
  }
}

// ==========================================
// SYSTEM EVENT LISTENERS (CRITICAL FOR OFFLINE PWA)
// ==========================================
window.addEventListener('online', () => {
    console.log("📶 [Network] Connection restored. Initiating sync flush.");
    ProgressService.flushQueue();
});
window.addEventListener('offline', () => {
    console.warn("📵 [Network] Connection lost. Entering Offline Mode.");
});
window.addEventListener("beforeunload", () => {
    ProgressService.flushQueue();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
      ProgressService.flushQueue();
  }
});