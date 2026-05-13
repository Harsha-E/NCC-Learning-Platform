import { getDbInstance, collection, getDocs, doc, getDoc } from '../core/firebase-init.js';
import CacheService from '../core/cache.js';

const ContentService = {
  normalizeCertId(cert) {
      if (!cert) return 'cert-a';
      const cleanCert = cert.toString().toUpperCase().trim();
      
      // If input is "A", "B", or "C", try to match "certificate-x" first, then fallback to "cert-x"
      if (['A', 'B', 'C'].includes(cleanCert)) {
          const letter = cleanCert.toLowerCase();
          // We return "certificate-b" if that's what you used in the Admin Tool
          return `certificate-${letter}`; 
      }
      
      // Fallback for any other custom names
      return cert.toString().toLowerCase().replace(/\s+/g, '-'); 
  },

  // 1. THE GATEKEEPER: Checks if the curriculum was updated by Admin
  async verifyContentVersion() {
      const db = getDbInstance();
      try {
          const metaSnap = await getDoc(doc(db, 'metadata', 'contentVersion'));
          const cloudVersion = metaSnap.exists() ? metaSnap.data().version : 0;
          
          const localVersion = await CacheService.get('local_content_version') || 0;

          if (cloudVersion > localVersion) {
              console.warn(`🚨 [ContentService] New Curriculum Detected (Cloud: ${cloudVersion} > Local: ${localVersion}). Wiping Cache...`);
              await CacheService.invalidateAll();
              await CacheService.set('local_content_version', cloudVersion);
          } else {
              console.log("✅ [ContentService] Curriculum is up to date. Using Offline Cache.");
          }
      } catch (e) {
          console.warn("⚠️ Offline Mode: Skipping version check.");
      }
  },

  // 2. Fetch Modules (Protected by Cache)
  async getModules(certificate, wing) {
    await this.verifyContentVersion(); // Ensure we are on the latest version
    const certId = this.normalizeCertId(certificate);
    
    const cacheKey = `modules_${certId}`;
    const modulesData = await CacheService.fetchWithCache(cacheKey, async () => {
        const db = getDbInstance();
        const modsRef = collection(db, 'content', certId, 'modules');
        const snap = await getDocs(modsRef);
        
        const rawModules = [];
        snap.forEach(doc => rawModules.push({ id: doc.id, order: doc.data().order || 99, ...doc.data() }));
        return rawModules.sort((a, b) => a.order - b.order);
    });

    // Client-side filtering for specific wings (zero cost)
    return modulesData.filter(mod => 
        !mod.isWingSpecific || (mod.applicableWings && mod.applicableWings.includes(wing))
    );
  },

  async getModule(certificate, moduleId, wing) {
    const modules = await this.getModules(certificate, wing);
    return modules.find(mod => mod.id === moduleId) || null;
  },

  // 3. Fetch Chapters (Protected by Cache)
  async getChapters(certificate, moduleId) {
    const certId = this.normalizeCertId(certificate);
    const cacheKey = `chapters_${certId}_${moduleId}`;
    
    return await CacheService.fetchWithCache(cacheKey, async () => {
        const db = getDbInstance();
        const chaptersRef = collection(db, 'content', certId, 'modules', moduleId, 'chapters');
        const snap = await getDocs(chaptersRef);
        
        const chapters = [];
        snap.forEach(doc => chapters.push({ id: doc.id, order: doc.data().order || 99, ...doc.data() }));
        return chapters.sort((a, b) => a.order - b.order);
    });
  },

  // 4. Fetch Specific Chapter Content & Quiz (Protected by Cache)
  async getChapter(certificate, moduleId, chapterId) {
    const certId = this.normalizeCertId(certificate);
    const cacheKey = `chapter_body_${certId}_${moduleId}_${chapterId}`;
    
    return await CacheService.fetchWithCache(cacheKey, async () => {
        const db = getDbInstance();
        const chapterRef = doc(db, 'content', certId, 'modules', moduleId, 'chapters', chapterId);
        const snap = await getDoc(chapterRef);
        
        return snap.exists() ? snap.data() : null;
    });
  }
};

export default ContentService;
