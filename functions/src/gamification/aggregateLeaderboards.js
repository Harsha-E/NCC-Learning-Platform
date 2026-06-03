// filepath: functions/src/gamification/aggregateLeaderboards.js
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const db = getFirestore();

export const aggregateLeaderboards = onSchedule('every 1 hours', async (event) => {
    logger.info('Starting Leaderboard Aggregation for current season...');
    
    // In a real scenario, this would be fetched from a global config
    const currentSeason = 'season_1'; 

    try {
        const seasonsRef = db.collection('gamification_seasons');
        
        // Optimize for 15k users: We only care about the top 100 for the global snapshot
        // We use orderBy and limit to avoid downloading 15,000 docs to the Cloud Function memory
        const topUsersSnapshot = await seasonsRef
            .where('season', '==', currentSeason)
            .orderBy('totalXp', 'desc')
            .limit(100)
            .get();

        if (topUsersSnapshot.empty) {
            logger.info('No gamification data found for aggregation.');
            return;
        }

        const top100 = [];
        let rank = 1;
        
        topUsersSnapshot.forEach((doc) => {
            const data = doc.data();
            top100.push({
                uid: doc.id,
                totalXp: data.totalXp,
                rank: rank,
                lastActive: data.lastActive // useful for tie-breaking visually
            });
            rank++;
        });

        // Write the flattened snapshot
        const leaderboardRef = db.doc(`leaderboards/global_top_100`);
        await leaderboardRef.set({
            season: currentSeason,
            lastUpdated: FieldValue.serverTimestamp(),
            entries: top100
        });

        logger.info(`Successfully aggregated Top 100 leaderboard. Snapshot saved.`);

    } catch (error) {
        logger.error('Error aggregating leaderboards:', error);
    }
});
