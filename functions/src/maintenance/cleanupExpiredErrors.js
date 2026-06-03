// filepath: functions/src/maintenance/cleanupExpiredErrors.js
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const db = getFirestore();

// Retention policy: 90 days for error logs
const RETENTION_DAYS = 90;

export const cleanupExpiredErrors = onSchedule('every 24 hours', async (event) => {
    logger.info('Starting scheduled cleanup of expired error logs...');

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - RETENTION_DAYS);

    try {
        const errorsRef = db.collection('error_logs');
        const snapshot = await errorsRef.where('timestamp', '<', expirationDate.getTime()).limit(500).get();

        if (snapshot.empty) {
            logger.info('No expired error logs found.');
            return;
        }

        const batch = db.batch();
        let deletedCount = 0;

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        await batch.commit();
        logger.info(`Successfully deleted ${deletedCount} expired error logs.`);

    } catch (error) {
        logger.error('Error cleaning up error logs:', error);
    }
});
