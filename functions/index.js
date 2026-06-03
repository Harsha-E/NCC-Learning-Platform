// filepath: functions/index.js
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

// Initialize the Admin SDK before any functions are loaded
initializeApp();

// Global config for all functions
setGlobalOptions({ maxInstances: 10, region: 'us-central1' });

// 1. Gamification
export { validateGamificationEvent } from './src/gamification/validateGamificationEvent.js';
export { aggregateLeaderboards } from './src/gamification/aggregateLeaderboards.js';

// 2. Content & Syllabus
export { onSyllabusUpdated } from './src/content/onSyllabusUpdated.js';

// 3. Maintenance (TTL Cleanup)
export { cleanupExpiredTelemetry } from './src/maintenance/cleanupExpiredTelemetry.js';
export { cleanupExpiredErrors } from './src/maintenance/cleanupExpiredErrors.js';

// 4. Attendance
export { validateAttendanceEvent } from './src/attendance/validateAttendanceEvent.js';
