// filepath: functions/src/maintenance/cleanupExpiredTelemetry.js
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const db = getFirestore();

// Retention policy: 30 days for telemetry
const RETENTION_DAYS = 30;

export const cleanupExpiredTelemetry = onSchedule('every 24 hours', async (event) => {
    logger.info('Starting scheduled cleanup of expired telemetry events...');

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - RETENTION_DAYS);

    try {
        const telemetryRef = db.collection('telemetry_events');
        // Requires a composite index on timestamp for this query to work if we sort, 
        // but simple filtering works with single-field indexes.
        const snapshot = await telemetryRef.where('timestamp', '<', expirationDate.getTime()).limit(500).get();

        if (snapshot.empty) {
            logger.info('No expired telemetry events found.');
            return;
        }

        const batch = db.batch();
        let deletedCount = 0;

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        await batch.commit();
        logger.info(`Successfully deleted ${deletedCount} expired telemetry events.`);
        
        // Note: For massive scale, this should loop or use Firebase Extensions (TTL),
        // but for NCC scale, a daily batch of 500-1000 is usually sufficient if run frequently.

    } catch (error) {
        logger.error('Error cleaning up telemetry events:', error);
    }
});
