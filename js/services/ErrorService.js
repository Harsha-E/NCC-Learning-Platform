import db from './DexieStore.js';
import { SyncEngine } from './SyncEngine.js';

export default class ErrorService {
    static init() {
        if (this.initialized) return;
        this.initialized = true;

        window.addEventListener('error', (event) => {
            this.logError('Syntax/Runtime Error', event.message, event.filename, event.lineno, event.colno, event.error?.stack);
        });

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            this.logError('Unhandled Promise Rejection', reason?.message || String(reason), null, null, null, reason?.stack);
        });

        // Try to flush occasionally
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.flushErrors();
        });
    }

    static async logError(type, message, source, lineno, colno, stack) {
        try {
            const errorRecord = {
                errorType: type,
                message: message,
                source: source,
                line: lineno,
                col: colno,
                stack: stack ? stack.substring(0, 1000) : null, // Truncate huge stacks
                timestamp: Date.now(),
                userAgent: navigator.userAgent
            };

            await db.analytics_errors.add(errorRecord);
            console.warn(`[ErrorService] Logged locally: ${type} - ${message}`);
        } catch (e) {
            console.error('[ErrorService] Failed to log error locally', e);
        }
    }

    static async flushErrors() {
        if (!navigator.onLine) return;

        try {
            const errors = await db.analytics_errors.toArray();
            if (errors.length === 0) return;

            // Batch into a single Firestore doc per flush to avoid spamming writes
            const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            
            // Queue via SyncEngine for eventual consistency
            await SyncEngine.queueUp(`system_errors/${batchId}`, {
                timestamp: Date.now(),
                count: errors.length,
                errors: errors // Array of error objects
            });

            await db.analytics_errors.clear();
            console.log(`[ErrorService] Queued ${errors.length} errors for upload.`);
        } catch (e) {
            console.error('[ErrorService] Failed to flush errors', e);
        }
    }
}
