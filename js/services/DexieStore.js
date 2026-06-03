import Dexie from 'https://unpkg.com/dexie/dist/dexie.mjs';
import { CONFIG } from './../core/config.js';

const db = new Dexie(CONFIG.COLLECTIONS.DEXIE.NAME);

db.version(6).stores({
  courses: 'id,title,lastUpdated',
  progress: 'userId,lastUpdated',
  sync_queue: '++id,path,status,timestamp',
  exam_sessions: 'examId,startedAt,submittedAt,version',
  user_cache: 'userId',
  analytics_events: '++id,eventType,timestamp',
  analytics_errors: '++id,errorType,timestamp',
  analytics_performance: '++id,metricName,timestamp',
  notifications: '++id,type,timestamp,read',
  gamification: '[userId+seasonId]'
});

// Phase 5 Data Integrity Schema Update
db.version(CONFIG.COLLECTIONS.DEXIE.VERSION).stores({
  progress: 'userId,lastUpdated,createdAt,updatedAt,version,deviceId,source',
  gamification: '[userId+seasonId],updatedAt,version',
  quiz_results: '++id,examId,userId,createdAt,version'
}).upgrade(tx => {
    // Re-index trigger on version bump
});

db.open().catch(async (err) => {
    console.error("Dexie Initialization Failed:", err);
    if (err.name === 'UpgradeError' || err.name === 'DatabaseClosedError' || err.message.includes('primary key')) {
        console.warn("Dexie Migration Failed: Wiping local database for safe recovery...");
        await Dexie.delete(CONFIG.COLLECTIONS.DEXIE.NAME);
        window.location.reload();
    }
});

export default db;
