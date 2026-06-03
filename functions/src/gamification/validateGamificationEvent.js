// filepath: functions/src/gamification/validateGamificationEvent.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const db = getFirestore();

// Hardcoded XP Rules for Server-side validation
const XP_RULES = {
    'quiz_passed': 500,
    'module_read': 100,
    'streak_maintained': 50
};

export const validateGamificationEvent = onDocumentCreated('gamification_events/{uid}/pending/{eventId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.error('No data associated with the event');
        return;
    }

    const { uid, eventId } = event.params;
    const data = snapshot.data();
    
    logger.info(`Validating Gamification Event`, { uid, eventId, type: data.type });

    try {
        await db.runTransaction(async (transaction) => {
            // 1. Idempotency Check (Has this already been processed?)
            const processedRef = db.doc(`gamification_events/${uid}/processed/${eventId}`);
            const processedSnap = await transaction.get(processedRef);
            
            if (processedSnap.exists) {
                logger.warn(`Event ${eventId} already processed. Skipping to prevent duplicate XP.`);
                // Clean up the dangling pending event
                transaction.delete(snapshot.ref);
                return;
            }

            // 2. Validate Event Type & XP Value
            const expectedXp = XP_RULES[data.type];
            if (!expectedXp) {
                logger.error(`Unknown event type: ${data.type}`);
                transaction.delete(snapshot.ref);
                return;
            }

            // 3. Optional: Verify Quiz Result exists if applicable
            if (data.type === 'quiz_passed' && data.referenceId) {
                const quizRef = db.doc(`quiz_results/${data.referenceId}`);
                const quizSnap = await transaction.get(quizRef);
                if (!quizSnap.exists || quizSnap.data().uid !== uid) {
                    logger.error(`Spoofing detected! Quiz result ${data.referenceId} does not exist for uid ${uid}`);
                    transaction.delete(snapshot.ref);
                    return;
                }
            }

            // 4. Apply XP to Current Season
            const currentSeason = 'season_1'; // Ideally fetched from a config doc
            const seasonRef = db.doc(`gamification_seasons/${uid}`);
            
            transaction.set(seasonRef, {
                totalXp: FieldValue.increment(expectedXp),
                lastActive: FieldValue.serverTimestamp(),
                season: currentSeason
            }, { merge: true });

            // 5. Move to Processed & Delete Pending
            transaction.set(processedRef, {
                ...data,
                awardedXp: expectedXp,
                processedAt: FieldValue.serverTimestamp()
            });
            transaction.delete(snapshot.ref);
            
            logger.info(`Successfully awarded ${expectedXp} XP to ${uid}`, { eventId });
        });
    } catch (error) {
        logger.error('Transaction failed in validateGamificationEvent', error);
        throw error; // Let Firebase retry if configured
    }
});
