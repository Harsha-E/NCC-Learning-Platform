import db from './DexieStore.js';
import Store from '../core/store.js';
import { SyncEngine } from './SyncEngine.js';
import { getDbInstance, collection, query, orderBy, limit, getDocs, doc, setDoc } from '../core/firebase-init.js';

export default class GamificationService {
    static CURRENT_SEASON = 'season_1';

    static async init() {
        if (this.initialized) return;
        this.initialized = true;

        const user = Store.get('user');
        if (!user) return;

        // Ensure a local record exists for the current season
        let record = await db.gamification.get({ userId: user.uid, seasonId: this.CURRENT_SEASON });
        if (!record) {
            record = {
                userId: user.uid,
                seasonId: this.CURRENT_SEASON,
                xp: 0,
                level: 1,
                streakDays: 0,
                lastActiveDate: null,
                achievements: [],
                history: [],
                missions: { daily: [], weekly: [], lastGenerated: null }
            };
            await db.gamification.put(record);
        }

        // Check streak on boot
        await this.updateStreak(user.uid, record);
    }

    static async updateStreak(uid, record) {
        const today = new Date().toISOString().split('T')[0];
        const lastActive = record.lastActiveDate;

        if (lastActive === today) return; // Already active today

        if (lastActive) {
            const lastDate = new Date(lastActive);
            const currentDate = new Date(today);
            const diffTime = Math.abs(currentDate - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Consecutive day
                record.streakDays += 1;
            } else if (diffDays > 1) {
                // Streak broken
                record.streakDays = 1;
            }
        } else {
            // First day ever
            record.streakDays = 1;
        }

        record.lastActiveDate = today;
        await db.gamification.put(record);
        
        // Broadcast streak event securely
        await this.queueServerValidation(uid, 'streak_update', { streakDays: record.streakDays });
    }

    /**
     * Award XP locally (optimistic UI) and send to Server for validation.
     * The Server is the source of truth for the Leaderboard.
     */
    static async awardXP(uid, amount, reason) {
        const record = await db.gamification.get({ userId: uid, seasonId: this.CURRENT_SEASON });
        if (!record) return;

        const oldRank = this.getRank(record.xp);
        record.xp += amount;
        
        // Track History
        if (!record.history) record.history = [];
        record.history.unshift({ amount, reason, timestamp: Date.now() });
        if (record.history.length > 100) record.history.length = 100;
        
        // Simple Leveling Curve: Level = floor(sqrt(XP / 100)) + 1
        const newLevel = Math.floor(Math.sqrt(record.xp / 100)) + 1;
        if (newLevel > record.level) {
            record.level = newLevel;
        }

        await db.gamification.put(record);

        // Check for Rank Promotion
        const newRank = this.getRank(record.xp);
        if (newRank !== oldRank) {
            window.dispatchEvent(new CustomEvent('rank_up', { 
                detail: { oldRank, newRank, currentXp: record.xp } 
            }));
        }

        // Notify UI components with rich payload for ToastManager
        window.dispatchEvent(new CustomEvent('xp_updated', { 
            detail: { xp: record.xp, level: record.level, added: amount, reason: reason } 
        }));

        // Queue Server Validation for robust tracking
        await this.queueServerValidation(uid, 'xp_gain', { amount, reason, timestamp: Date.now() });

        // Spark Mode: directly update the gamification_seasons collection for the leaderboard
        try {
            const dbFirestore = getDbInstance();
            const user = Store.get('user');
            const profile = Store.get('profile') || {};
            const rawName = (profile.displayName || profile.fullName || '').split(' ')[0] || user?.displayName || 'Cadet';
            
            await setDoc(doc(dbFirestore, 'gamification_seasons', this.CURRENT_SEASON, 'users', uid), {
                uid: uid,
                displayName: rawName,
                xp: record.xp,
                level: record.level,
                rank: newRank !== undefined ? newRank : oldRank,
                wing: profile.wing || 'army',
                lastActive: Date.now()
            }, { merge: true });
        } catch(e) {
            console.error("[Spark Mode] Failed to update gamification_seasons collection directly:", e);
        }
    }

    static async queueServerValidation(uid, eventType, payload) {
        const eventId = `g_evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await SyncEngine.queueUp(`gamification_events/${uid}/pending/${eventId}`, {
            eventType,
            seasonId: this.CURRENT_SEASON,
            ...payload
        });
    }

    static async getStats(uid) {
        let record = await db.gamification.get({ userId: uid, seasonId: this.CURRENT_SEASON });
        if (!record) {
            await this.init();
            record = await db.gamification.get({ userId: uid, seasonId: this.CURRENT_SEASON });
        }
        return record;
    }

    /**
     * Map XP to NCC Ranks
     */
    static getRank(xp) {
        if (xp >= 10000) return 'Senior Under Officer';
        if (xp >= 5000) return 'Junior Under Officer';
        if (xp >= 2500) return 'Sergeant';
        if (xp >= 1000) return 'Corporal';
        if (xp >= 500) return 'Lance Corporal';
        if (xp >= 100) return 'Cadet';
        return 'Recruit';
    }

    /**
     * Calculate progress for the current level (XP Bar)
     * Level = floor(sqrt(XP / 100)) + 1
     */
    static getLevelProgress(xp) {
        const level = Math.floor(Math.sqrt(xp / 100)) + 1;
        
        // XP required to reach CURRENT level
        const currentLevelXp = Math.pow(level - 1, 2) * 100;
        
        // XP required to reach NEXT level
        const nextLevelXp = Math.pow(level, 2) * 100;
        
        const xpInCurrentLevel = xp - currentLevelXp;
        const xpRequiredForNextLevel = nextLevelXp - currentLevelXp;
        const percentage = Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForNextLevel) * 100));
        
        return {
            level,
            rank: this.getRank(xp),
            currentXp: xp,
            currentLevelBaseXp: currentLevelXp,
            nextLevelXp,
            xpInCurrentLevel,
            xpRequiredForNextLevel,
            percentage
        };
    }

    static async incrementAchievementProgress(uid, achievementId, title, maxProgress) {
        const record = await db.gamification.get({ userId: uid, seasonId: this.CURRENT_SEASON });
        if (!record) return;
        
        if (!record.achievements) record.achievements = [];
        
        let ach = record.achievements.find(a => a.id === achievementId);
        if (!ach) {
            ach = { id: achievementId, title, progress: 0, maxProgress, unlocked: false };
            record.achievements.push(ach);
        }
        
        if (!ach.unlocked) {
            ach.progress += 1;
            if (ach.progress >= ach.maxProgress) {
                ach.unlocked = true;
                ach.progress = ach.maxProgress;
                ach.unlockedAt = Date.now();
                // Award bonus XP
                await this.awardXP(uid, 100, `Achievement: ${title}`);
            }
            await db.gamification.put(record);
        }
    }

    static async getNextRank(currentXp) {
        const thresholds = [
            { rank: 'Cadet', xp: 100 },
            { rank: 'Lance Corporal', xp: 500 },
            { rank: 'Corporal', xp: 1000 },
            { rank: 'Sergeant', xp: 2500 },
            { rank: 'Junior Under Officer', xp: 5000 },
            { rank: 'Senior Under Officer', xp: 10000 }
        ];
        
        const next = thresholds.find(t => t.xp > currentXp);
        if (!next) return null; // MAX RANK
        
        return next;
    }

    static async checkAndGenerateMissions(uid) {
        let record = await db.gamification.get({ userId: uid, seasonId: this.CURRENT_SEASON });
        if (!record) {
            await this.init();
            record = await db.gamification.get({ userId: uid, seasonId: this.CURRENT_SEASON });
            if (!record) return null;
        }

        if (!record.missions) {
            record.missions = { daily: [], weekly: [], lastGenerated: null };
        }

        const today = new Date().toISOString().split('T')[0];
        
        if (record.missions.lastGenerated !== today) {
            // Generate Daily
            record.missions.daily = [
                { id: 'd1', title: 'Complete 1 Quiz', reward: 25, progress: 0, target: 1, completed: false },
                { id: 'd2', title: 'Read 2 Chapters', reward: 30, progress: 0, target: 2, completed: false }
            ];
            
            // Check if Weekly needs generation (e.g. if it's Monday or if weekly is empty)
            const isMonday = new Date().getDay() === 1;
            if (isMonday || !record.missions.weekly || record.missions.weekly.length === 0) {
                record.missions.weekly = [
                    { id: 'w1', title: 'Maintain a 5-day Streak', reward: 150, progress: record.streakDays > 5 ? 5 : record.streakDays, target: 5, completed: false },
                    { id: 'w2', title: 'Score 100% in a Mock Exam', reward: 200, progress: 0, target: 1, completed: false }
                ];
            }

            record.missions.lastGenerated = today;
            await db.gamification.put(record);
        }
        
        return record.missions;
    }

    static async getGlobalLeaderboard() {
        if (!navigator.onLine) {
            return { error: 'Leaderboard requires an active connection.', top100: [] };
        }
        try {
            const dbFirestore = getDbInstance();
            if (!dbFirestore) return { top100: [] };
            
            // Generate mock data fallback
            const mockData = Array.from({length: 100}).map((_, i) => ({
                uid: 'mock_' + i,
                displayName: ['Arjun', 'Vikram', 'Riya', 'Karan', 'Neha'][i % 5] + ' ' + (i+1),
                rank: i < 3 ? 'Senior Under Officer' : i < 10 ? 'Junior Under Officer' : 'Sergeant',
                xp: 15000 - (i * 120),
                level: 30 - Math.floor(i/3),
                wing: ['army', 'navy', 'airforce'][i % 3]
            }));

            // Spark Mode: Query the gamification_seasons collection directly
            const leaderboardsRef = collection(dbFirestore, 'gamification_seasons', this.CURRENT_SEASON, 'users');
            const q = query(leaderboardsRef, orderBy('xp', 'desc'), limit(100));
            const querySnapshot = await getDocs(q);

            const top100 = [];
            querySnapshot.forEach((doc) => {
                top100.push(doc.data());
            });

            // Return real data if available, else fallback to mock
            if (top100.length > 0) {
                return { top100 };
            } else {
                return { top100: mockData };
            }
        } catch (e) {
            console.error(e);
            return { error: 'Failed to sync leaderboard.', top100: [] };
        }
    }
}
