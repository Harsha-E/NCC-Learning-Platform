import { getDbInstance, doc, getDoc, writeBatch } from "../core/firebase-init.js";
import Store from "../core/store.js";
import ContentService from "./content.service.js";

// ==========================================
// UTILITY & SANITIZATION
// ==========================================
const isObject = (item) => {
  return (item && typeof item === 'object' && !Array.isArray(item));
};

const deepMerge = (target, source) => {
  let output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
};

const sanitizePayload = (obj) => {
  try {
      return JSON.parse(JSON.stringify(obj));
  } catch (e) {
      console.warn("[ProgressService] Sanitization failed, returning raw object.");
      return obj;
  }
};

// ==========================================
// OFFLINE-FIRST QUEUE DATABASE (IndexedDB)
// ==========================================
const initQueueDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open('NCC_SyncQueue', 3);
  
  req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'path' });
      }
  };
  
  req.onsuccess = () => resolve(req.result);
  
  req.onerror = (e) => {
      console.error("[ProgressService] Fatal DB Error:", req.error);
      reject(req.error);
  };
  
  req.onblocked = () => {
      console.warn("[ProgressService] IndexedDB is blocked. Bypassing.");
      reject(new Error("DB Blocked"));
  };
});

const persistToQueue = async (path, data) => {
  try {
      const db = await initQueueDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('progress', 'readwrite');
        const store = tx.objectStore('progress');
        const req = store.get(path);
        
        req.onsuccess = () => {
          const existing = req.result || { path, data: {} };
          existing.data = deepMerge(existing.data, data);
          const putReq = store.put(existing);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        
        req.onerror = () => reject(req.error);
      });
  } catch (err) {
      console.warn("[ProgressService] Persist bypassed. Moving to local memory.");
  }
};

let debounceTimeout = null;

// ==========================================
// PROGRESS SERVICE CORE
// ==========================================
export default class ProgressService {
  
  static async queueWrite(path, data) {
    // Race the database task against a 2 second timer to prevent UI freezes.
    const timeout = new Promise(resolve => setTimeout(resolve, 2000));
    
    const writeTask = async () => {
        await persistToQueue(path, data);
        
        // PWA Background Sync Registration
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && reg.sync) {
                await reg.sync.register('sync-progress');
            }
          } catch (err) {}
        }
        
        // If online, flush after 5 seconds of inactivity
        if (navigator.onLine) {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => this.flushQueue(), 5000);
        } else {
            console.log("📶 [Offline Mode]: Progress saved securely to local queue.");
        }
    };

    await Promise.race([writeTask(), timeout]);
  }

  static async flushQueue() {
    // Prevent flushing if there is no internet
    if (!navigator.onLine) return;

    try {
      const db = await initQueueDB();
      
      const writes = await new Promise((resolve, reject) => {
        const tx = db.transaction('progress', 'readonly');
        const req = tx.objectStore('progress').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!writes || writes.length === 0) return;

      const firestore = getDbInstance();
      const batch = writeBatch(firestore);
      
      writes.forEach(item => {
        const cleanData = sanitizePayload(item.data);
        batch.set(doc(firestore, item.path), cleanData, { merge: true });
      });

      await batch.commit();

      // Clear queue after successful cloud sync
      await new Promise((resolve, reject) => {
        const tx = db.transaction('progress', 'readwrite');
        const req = tx.objectStore('progress').clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject();
      });
      
      console.log(`☁️ [Cloud Sync] Flushed secure progress. (${writes.length} items updated)`);
    } catch (e) {
      console.warn('⚠️ [Sync] Flush delayed due to network instability. Will retry.');
    }
  }

  static async getUserProgress(uid) {
    if (!uid) return { modules: {} };
    try {
      const db = getDbInstance();
      const snap = await getDoc(doc(db, 'progress', uid));
      
      if (snap.exists()) {
        const data = snap.data();
        Store.set('userProgress', data);
        return data;
      }
      return { modules: {} };
    } catch (error) {
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

// 1. Instantly flush queue the second the browser detects internet connection
window.addEventListener('online', () => {
    console.log("📶 [Network] Connection restored. Initiating sync flush.");
    ProgressService.flushQueue();
});

// 2. Log when Cadet goes offline
window.addEventListener('offline', () => {
    console.warn("📵 [Network] Connection lost. Entering Offline Mode.");
});

// 3. Flush queue if Cadet tries to close the tab
window.addEventListener("beforeunload", () => {
    ProgressService.flushQueue();
});

// 4. Flush queue if Cadet minimizes the app on mobile
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
      ProgressService.flushQueue();
  }
});