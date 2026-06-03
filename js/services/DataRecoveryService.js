import db from './DexieStore.js';
import ErrorService from './ErrorService.js';
import { CONFIG } from '../core/config.js';

class DataRecoveryService {
    constructor() {
        this.recoveryLevels = {
            1: 'Repair Records',
            2: 'Repair Tables',
            3: 'Request Confirmation',
            4: 'Full Rebuild'
        };
    }

    /**
     * Level 1: Non-destructive field patching
     */
    async repairRecords(tableName) {
        console.warn(`[DataRecovery] Level 1: Repairing records in ${tableName}`);
        try {
            const table = db.table(tableName);
            const records = await table.toArray();
            let repaired = 0;

            for (const record of records) {
                let needsUpdate = false;
                if (!record.createdAt) { record.createdAt = new Date().toISOString(); needsUpdate = true; }
                if (!record.updatedAt) { record.updatedAt = new Date().toISOString(); needsUpdate = true; }
                if (!record.version) { record.version = 1; needsUpdate = true; }

                if (needsUpdate) {
                    await table.put(record);
                    repaired++;
                }
            }
            if (repaired > 0) console.log(`[DataRecovery] Repaired ${repaired} records in ${tableName}.`);
            return true;
        } catch (error) {
            ErrorService.logError(error, { context: 'DataRecoveryService.repairRecords', table: tableName });
            return false;
        }
    }

    /**
     * Level 2: Table-level rebuild from network
     */
    async repairTables(tableName, fetchFunction) {
        console.warn(`[DataRecovery] Level 2: Repairing table ${tableName}`);
        try {
            const data = await fetchFunction();
            if (!data) throw new Error('Fetch failed during table repair');

            await db.transaction('rw', db.table(tableName), async () => {
                await db.table(tableName).clear();
                await db.table(tableName).bulkAdd(data);
            });
            console.log(`[DataRecovery] Rebuilt table ${tableName}.`);
            return true;
        } catch (error) {
            ErrorService.logError(error, { context: 'DataRecoveryService.repairTables', table: tableName });
            return false;
        }
    }

    /**
     * Level 3: Request user permission for destructive action
     */
    async requestConfirmation(promptMessage) {
        console.warn(`[DataRecovery] Level 3: Requesting confirmation for destructive action.`);
        return new Promise((resolve) => {
            const confirmation = window.confirm(promptMessage || 'Critical synchronization error detected. Rebuild local cache? Unsynced offline progress may be lost.');
            resolve(confirmation);
        });
    }

    /**
     * Level 4: Full database wipe and rehydration
     */
    async fullRebuild() {
        console.warn(`[DataRecovery] Level 4: Full Rebuild initiated.`);
        const confirmed = await this.requestConfirmation();
        if (!confirmed) {
            console.warn(`[DataRecovery] Full Rebuild aborted by user.`);
            return false;
        }

        try {
            await db.delete();
            await db.open();
            window.location.reload(); // Force reload to re-run boot sequence
            return true;
        } catch (error) {
            ErrorService.logError(error, { context: 'DataRecoveryService.fullRebuild' });
            return false;
        }
    }

    /**
     * Diagnostic scan run on boot
     */
    async scanHealth() {
        try {
            // Check for stuck sync queue
            const queue = await db.sync_queue.toArray();
            const now = Date.now();
            
            // Log stale items, but don't panic. SyncEngine will purge them at 7 days.
            const staleItems = queue.filter(item => (now - item.timestamp) > 7 * 24 * 60 * 60 * 1000); 

            if (staleItems.length > 0) {
                console.warn(`[DataRecovery] Detected ${staleItems.length} heavily stale items. Trusting SyncEngine to purge.`);
            }
            
            // Background Level 1 scan
            await this.repairRecords('progress');
            await this.repairRecords('gamification');
            
        } catch (error) {
            ErrorService.logError(error, { context: 'DataRecoveryService.scanHealth' });
        }
    }
}

export default new DataRecoveryService();
