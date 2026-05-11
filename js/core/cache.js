const DB_NAME = 'NCC_Command_Cache';
const DB_VERSION = 1;
const STORE_NAME = 'CurriculumStore';

export default class CacheService {
    static async initDB() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = e => reject("IndexedDB error: " + e.target.error);
            request.onsuccess = e => { this.db = e.target.result; resolve(this.db); };
            request.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    static async get(key) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => resolve(null); // Fail gracefully
        });
    }

    static async set(key, value) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put({ value: value }, key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(false);
        });
    }

    static async invalidateAll() {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => {
                console.log("🧹 [CacheService] IndexedDB Cleared.");
                resolve(true);
            };
        });
    }

    // Advanced wrapper: Checks cache, if miss, runs the fetcher, saves to cache, returns data
    static async fetchWithCache(key, fetchCallback) {
        const cachedData = await this.get(key);
        if (cachedData) {
            console.log(`⚡ [Cache Hit]: ${key} (0 Firebase Reads)`);
            return cachedData;
        }

        console.log(`☁️ [Cache Miss]: Fetching ${key} from Firebase...`);
        const freshData = await fetchCallback();
        if (freshData) {
            await this.set(key, freshData);
        }
        return freshData;
    }
}