# CHANGELOG

## NCC-v4 Master Execution Log

*Every file modified during this phase will be documented here with Reason, Impact, and Rollback procedure.*

### Document Initialization
- **File**: `CHANGELOG.md`, `PERFORMANCE_BUDGET.md`, `IMPLEMENTATION_AUDIT.md`
- **Reason**: Step 0 & 1 setup for Master Execution Directive.
- **Impact**: Provides governance and traceability for the massive phase 4 rollout.
- **Rollback**: Delete these files.

### Error Framework Implementation
- **File**: `js/services/ErrorService.js`, `js/core/app.js`
- **Reason**: Step 2: Catch `window.onerror` and `unhandledrejection` to track client-side bugs natively.
- **Impact**: Errors are now cached in Dexie and batched to Firestore via SyncEngine to avoid write-spam.
- **Rollback**: Delete the file and remove imports from main app.

### Analytics Framework Implementation
- **File**: `js/services/AnalyticsService.js`, `js/core/app.js`
- **Reason**: Step 3: Track user events locally and batch upload.
- **Impact**: Aggregates daily events locally instead of writing 300,000 raw events to Firestore.
- **Rollback**: Delete `AnalyticsService.js` and remove initialization.

### Notification Infrastructure
- **File**: `fcm-sw.js`, `js/services/NotificationService.js`, `js/services/DexieStore.js`
- **Reason**: Step 4: Setup push notification listeners and local storage.
- **Impact**: Enables background receiving of FCM notifications, saves them locally, supports topic preference routing. Upgraded Dexie to v5.
- **Rollback**: Revert `DexieStore.js` to v4, delete `fcm-sw.js` and `NotificationService.js`.

### Notification Center
- **File**: `js/components/navbar.js`
- **Reason**: Step 5: Provide UI for viewing local notification history.
- **Impact**: Injects a Notification Bell and Drawer into the navbar.
- **Rollback**: Remove DOM injection code from `navbar.js`.

### Gamification Foundation
- **File**: `js/services/GamificationService.js`, `js/core/app.js`
- **Reason**: Step 6: Add XP, Levels, Streaks, and Seasons.
- **Impact**: Provides client-side estimation of gamification metrics while delegating true authoritative rank validation to Cloud Functions via `gamification_events` sync queue.
- **Rollback**: Delete `GamificationService.js` and remove initialization.

### Achievement Framework
- **File**: `data/achievement-definitions.json`
- **Reason**: Step 7: Define the JSON schema for badges and logic.
- **Impact**: Prepares the client to award badges for 'first blood', streaks, and perfect quizzes.
- **Rollback**: Delete the JSON file.

### Syllabus Versioning
- **File**: `js/services/content.service.js`
- **Reason**: Step 8: Alert cadets when syllabus updates.
- **Impact**: The diff engine triggers a native and local notification when `cloudVersion > localVersion`.
- **Rollback**: Remove diff notification logic from `verifyContentVersion`.
