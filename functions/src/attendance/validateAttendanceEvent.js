// filepath: functions/src/attendance/validateAttendanceEvent.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const db = getFirestore();

export const validateAttendanceEvent = onDocumentCreated('attendance_events/{uid}/pending/{eventId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.error('No data associated with the attendance event');
        return;
    }

    const { uid, eventId } = event.params;
    const data = snapshot.data();
    
    // We expect the client to provide the sessionId (e.g. "parade_2024_06_03")
    const sessionId = data.sessionId;
    if (!sessionId) {
        logger.error('Missing sessionId in attendance event');
        await snapshot.ref.delete();
        return;
    }

    logger.info(`Validating Attendance for cadet ${uid} at session ${sessionId}`);

    try {
        await db.runTransaction(async (transaction) => {
            // Check if the cadet has already been marked present for this specific session
            const attendanceRecordRef = db.doc(`attendance_records/${sessionId}/cadets/${uid}`);
            const recordSnap = await transaction.get(attendanceRecordRef);

            if (recordSnap.exists) {
                logger.warn(`Duplicate attendance detected! Cadet ${uid} is already present for ${sessionId}.`);
                // Clean up the pending event to prevent looping
                transaction.delete(snapshot.ref);
                return;
            }

            // Mark present securely
            transaction.set(attendanceRecordRef, {
                timestamp: FieldValue.serverTimestamp(),
                markedBy: data.markedBy || uid, // could be self or instructor
                status: 'present',
                locationHash: data.locationHash || null // GPS spoofing check integration point
            });

            // Clean up the pending event
            transaction.delete(snapshot.ref);
            logger.info(`Successfully logged attendance for ${uid} at ${sessionId}`);
        });
    } catch (error) {
        logger.error('Transaction failed in validateAttendanceEvent', error);
        throw error;
    }
});
