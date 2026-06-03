import db from './DexieStore.js';
import { getDbInstance, doc, setDoc } from '../core/firebase-init.js';
import { CONFIG } from '../core/config.js';

export const SyncEngine = {
  /**
   * Appends mandatory data integrity metadata to any payload.
   */
  appendIntegrityMetadata(payload) {
    const deviceId = localStorage.getItem('ncc_device_id') || ('device_' + Math.random().toString(36).substring(2));
    localStorage.setItem('ncc_device_id', deviceId);
    
    return {
      ...payload,
      _metadata: {
        createdAt: payload.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (payload.version || 0) + 1,
        deviceId: deviceId,
        source: 'NCC-v4-Client'
      }
    };
  },

  /**
   * Instantly saves data locally to Dexie, and queues the write for Firebase.
   * 
   * @param {string} path - Firebase document path (e.g., 'progress/USER_ID')
   * @param {Object} data - The partial data payload to merge
   * @param {string} resolutionStrategy - 'merge', 'overwrite', or 'append'
   */
  async queueUp(path, data, resolutionStrategy = 'merge') {
    try {
      const payloadWithMetadata = this.appendIntegrityMetadata(data);

      // 1. Save locally to Dexie based on entity path
      if (path.startsWith('progress/')) {
          const userId = path.split('/')[1];
          const existing = await db.progress.get(userId) || { userId, data: {} };
          
          if (resolutionStrategy === 'merge') {
              // Deep merge logic locally
              const deepMerge = (target, source) => {
                let output = Object.assign({}, target);
                if (target && typeof target === 'object' && !Array.isArray(target) && source && typeof source === 'object' && !Array.isArray(source)) {
                  Object.keys(source).forEach(key => {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                      if (!(key in target)) Object.assign(output, { [key]: source[key] });
                      else output[key] = deepMerge(target[key], source[key]);
                    } else {
                      // Custom rule: if both are numbers and we are in gamification context, we could add them, 
                      // but standard deep merge just overwrites scalar values.
                      Object.assign(output, { [key]: source[key] });
                    }
                  });
                }
                return output;
              };
              existing.data = deepMerge(existing.data, payloadWithMetadata);
          } else {
              // Overwrite
              existing.data = payloadWithMetadata;
          }
          
          existing.updatedAt = payloadWithMetadata._metadata.updatedAt;
          existing.createdAt = payloadWithMetadata._metadata.createdAt;
          existing.version = payloadWithMetadata._metadata.version;
          existing.deviceId = payloadWithMetadata._metadata.deviceId;
          existing.source = payloadWithMetadata._metadata.source;

          await db.progress.put(existing);
      }

      // 2. Add to background sync queue with durability
      // Use robust UUID to prevent duplicate queue items across identical operations
      const actionHash = crypto.randomUUID();
      
      const existingQueueItem = await db.sync_queue.where('path').equals(path).filter(item => item.status === 'pending').first();
      
      if (existingQueueItem) {
          // Merge pending items to avoid queue explosion
          if (resolutionStrategy === 'merge') {
              existingQueueItem.payload = { ...existingQueueItem.payload, ...payloadWithMetadata };
          } else {
              existingQueueItem.payload = payloadWithMetadata;
          }
          existingQueueItem.timestamp = Date.now();
          await db.sync_queue.put(existingQueueItem);
      } else {
          await db.sync_queue.add({
            path: path,
            payload: payloadWithMetadata,
            status: 'pending',
            retryCount: 0,
            timestamp: Date.now(),
            resolutionStrategy: resolutionStrategy
          });
      }

      console.log(`QueueUp: Data saved locally and queued for ${path} [Strategy: ${resolutionStrategy}]`);

    } catch (error) {
      console.error('QueueUp Error:', error);
    }
  },

  /**
   * Reads from the sync queue and pushes debounced/batched writes to Firebase.
   */
  async flushQueue() {
    if (!navigator.onLine) return;

    try {
      const pendingSyncs = await db.sync_queue.where('status').equals('pending').toArray();
      if (pendingSyncs.length === 0) return;

      const firestore = getDbInstance();
      const now = Date.now();
      
      for (const item of pendingSyncs) {
        // 1. Stale Items Handling (Older than 7 days)
        const ageInDays = (now - item.timestamp) / (1000 * 60 * 60 * 24);
        if (ageInDays > 7) {
            const isUserGenerated = item.path.startsWith('progress/') || item.path.startsWith('gamification_events/') || item.path.startsWith('quiz_results/');
            
            if (isUserGenerated) {
                console.warn(`[SyncEngine] Moving critical stale sync item to recovery queue (Age: ${ageInDays} days): ${item.path}`);
                await db.sync_queue.update(item.id, { status: 'stale_recovery' });
            } else {
                console.warn(`[SyncEngine] Purging non-critical stale sync item (Age: ${ageInDays} days): ${item.path}`);
                await db.sync_queue.update(item.id, { status: 'stale_purged' });
            }
            continue;
        }

        // 2. Exponential Backoff Check
        if (item.retryCount > 0) {
            const backoffDelay = Math.pow(2, item.retryCount) * (CONFIG.SYSTEM.SYNC_RETRY_BACKOFF_MS || 2000); 
            if (now - item.timestamp < backoffDelay) {
                continue; // Skip until backoff window clears
            }
        }

        try {
            const docRef = doc(firestore, item.path);
            
            // Apply Firebase specific resolution strategy
            if (item.resolutionStrategy === 'merge') {
                await setDoc(docRef, item.payload, { merge: true });
            } else if (item.resolutionStrategy === 'overwrite') {
                await setDoc(docRef, item.payload);
            } else {
                // Default to merge for safety
                await setDoc(docRef, item.payload, { merge: true });
            }
            
            // Remove from queue after successful push
            await db.sync_queue.delete(item.id);
        } catch (e) {
            console.error(`Failed to sync ${item.path}:`, e);
            // Increment retry count for exponential backoff
            await db.sync_queue.update(item.id, {
                retryCount: item.retryCount + 1,
                timestamp: Date.now(), // Reset timestamp for next backoff calc
                status: item.retryCount >= (CONFIG.SYSTEM.MAX_SYNC_RETRIES || 5) ? 'failed' : 'pending' 
            });
        }
      }

      console.log(`FlushQueue: Pending writes processed.`);
    } catch (error) {
      console.error('FlushQueue Error:', error);
    }
  }
};

// ==========================================
// DURABLE BATCH SYNCING
// ==========================================
// Flush the queue every 30 seconds to prevent Firebase write spikes
setInterval(() => {
  SyncEngine.flushQueue();
}, 30000);

// Automatically flush queue when network is restored
window.addEventListener('online', () => {
  console.log('Network restored. Flushing Dexie sync queue...');
  SyncEngine.flushQueue();
});
