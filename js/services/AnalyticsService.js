import db from './DexieStore.js';
import { SyncEngine } from './SyncEngine.js';

export default class AnalyticsService {
    static init() {
        if (this.initialized) return;
        this.initialized = true;

        // Attempt flush occasionally (every 5 mins)
        setInterval(() => this.flushAggregates(), 300000);
        
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.flushAggregates();
        });
    }

    /**
     * Tracks a raw event in Dexie.
     * Allowed types: 'login', 'chapter_read', 'quiz_passed', 'course_completed'
     */
    static async trackEvent(eventType, metadata = {}) {
        try {
            const eventRecord = {
                eventType,
                metadata,
                timestamp: Date.now()
            };
            await db.analytics_events.add(eventRecord);
            console.log(`[Analytics] Tracked: ${eventType}`);
        } catch (e) {
            console.warn('[Analytics] Failed to track event locally', e);
        }
    }

    /**
     * Aggregates raw events from Dexie and queues them for Firestore.
     * This prevents 300,000 raw events from reaching Firestore directly.
     */
    static async flushAggregates() {
        if (!navigator.onLine) return;

        try {
            const events = await db.analytics_events.toArray();
            if (events.length === 0) return;

            // 1. Group events by Date and Type
            // Format: YYYY-MM-DD
            const aggregates = {};

            events.forEach(evt => {
                const dateStr = new Date(evt.timestamp).toISOString().split('T')[0];
                const key = `${dateStr}_${evt.eventType}`;
                
                if (!aggregates[key]) {
                    aggregates[key] = {
                        date: dateStr,
                        eventType: evt.eventType,
                        count: 0,
                        latestTimestamp: 0
                    };
                }
                
                aggregates[key].count++;
                if (evt.timestamp > aggregates[key].latestTimestamp) {
                    aggregates[key].latestTimestamp = evt.timestamp;
                }
            });

            // 2. Queue the aggregates to Firestore (using a Cloud Function endpoint or batch write path)
            // For now, we queue it to a generic `analytics_daily_sync` path
            const batchId = `analytics_${Date.now()}`;
            await SyncEngine.queueUp(`analytics_aggregate/${batchId}`, {
                timestamp: Date.now(),
                aggregates: Object.values(aggregates),
                rawEventsProcessed: events.length
            });

            // 3. Clear processed raw events
            const eventIds = events.map(e => e.id);
            await db.analytics_events.bulkDelete(eventIds);
            
            console.log(`[Analytics] Aggregated and queued ${events.length} events for upload.`);
        } catch (e) {
            console.error('[Analytics] Failed to flush aggregates', e);
        }
    }
}
