// filepath: functions/src/content/onSyllabusUpdated.js
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';

export const onSyllabusUpdated = onDocumentWritten('content/{docId}', async (event) => {
    // We only want to trigger on actual content updates or creations, not deletions
    if (!event.data.after.exists) {
        logger.info('Content deleted, skipping cache invalidation push.');
        return;
    }

    const docId = event.params.docId;
    const newData = event.data.after.data();
    const oldData = event.data.before.exists ? event.data.before.data() : null;

    // Check if there's a meaningful change (e.g. status changed to published)
    if (oldData && oldData.updatedAt === newData.updatedAt) {
        logger.info('No meaningful update detected. Skipping.');
        return;
    }

    logger.info(`Content updated (${docId}). Sending global FCM cache invalidation.`);

    const message = {
        topic: 'global',
        data: {
            type: 'SYLLABUS_UPDATE',
            docId: docId,
            timestamp: Date.now().toString(),
            // Instruct clients to invalidate their local Dexie caches
            action: 'INVALIDATE_CACHE'
        }
    };

    try {
        const response = await getMessaging().send(message);
        logger.info('Successfully sent FCM syllabus update message:', response);
    } catch (error) {
        logger.error('Error sending FCM syllabus update message:', error);
    }
});
