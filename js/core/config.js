// filepath: js/core/config.js
/**
 * NCC Learning Platform - Centralized Configuration
 * Extracts all magic numbers and hardcoded paths into a single source of truth.
 */

export const CONFIG = {
    // 1. Firebase Project Configuration
    FIREBASE: {
        apiKey: "AIzaSyBDhUcT_-0LLI5bM3MARRPCNy5XqUJb3OU",
        authDomain: "ncc-1945.firebaseapp.com",
        projectId: "ncc-1945",
        storageBucket: "ncc-1945.firebasestorage.app",
        messagingSenderId: "581810935602",
        appId: "1:581810935602:web:8cedf4d1109a7d401c292b"
    },

    // 2. Database Collection & Table Names
    COLLECTIONS: {
        FIRESTORE: {
            USERS: 'users',
            PROGRESS: 'progress',
            CONTENT: 'content',
            QUIZ_RESULTS: 'quiz_results',
            GAMIFICATION_SEASONS: 'gamification_seasons',
            TELEMETRY: 'telemetry_events',
            ERRORS: 'error_logs'
        },
        DEXIE: {
            NAME: 'NCC_Platform_DB',
            VERSION: 7
        }
    },

    // 3. Application Versioning & Limits
    SYSTEM: {
        APP_VERSION: '4.1.0',
        MAX_SYNC_RETRIES: 5,
        SYNC_RETRY_BACKOFF_MS: 2000, // Exponential backoff base
        MAX_OFFLINE_DAYS: 30, // Days before offline cache is considered stale
    },

    // 4. Feature Flags
    FEATURES: {
        ENABLE_GAMIFICATION: true,
        ENABLE_OFFLINE_QUIZ: true,
        ENABLE_MOCK_EXAMS: false, // Turned off until Phase 6
        REQUIRE_EMAIL_VERIFICATION_CADET: true
    },

    // 5. Gamification Constants
    GAMIFICATION: {
        CURRENT_SEASON: 'season_1',
        XP: {
            CHAPTER_READ: 10,
            QUIZ_PASS: 50,
            QUIZ_PERFECT: 100,
            DAILY_LOGIN: 5
        },
        THRESHOLDS: {
            CADET: 0,
            LANCE_CORPORAL: 1000,
            CORPORAL: 3000,
            SERGEANT: 6000
        }
    }
};
