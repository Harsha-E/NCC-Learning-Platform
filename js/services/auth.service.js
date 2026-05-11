// filepath: js/services/auth.service.js
// Authentication Service for NCC Cadet Learning Platform

import { 
  getAuthInstance, 
  getDbInstance,
  onAuthChange,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from '../core/firebase-init.js';
import Store from '../core/store.js';

// Import Firebase Auth functions directly
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Auth Service
const AuthService = {
  // Current user
  currentUser: null,
  
  // Initialize auth listener
  init() {
    return new Promise((resolve) => {
      onAuthChange(async (authData) => {
        if (authData) {
          this.currentUser = authData.user;
          
          // Get user profile from Firestore
          const profile = await this.getProfile(authData.user.uid);
          
          Store.set('user', {
            uid: authData.user.uid,
            email: authData.user.email,
            displayName: authData.user.displayName,
            photoURL: authData.user.photoURL,
            emailVerified: authData.user.emailVerified,
            role: authData.role
          });
          
          Store.set('profile', profile);
          
          resolve({ user: authData.user, profile });
        } else {
          this.currentUser = null;
          Store.set('user', null);
          Store.set('profile', null);
          resolve(null);
        }
      });
    });
  },
  
  // Register new cadet
  async register(email, password, fullName, serviceNumber, phoneNumber) {
    const auth = getAuthInstance();
    const db = getDbInstance();
    
    // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Send email verification
    await sendEmailVerification(user);
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      displayName: fullName,
      email: email,
      serviceNumber: serviceNumber,
      phoneNumber: phoneNumber,
      role: 'cadet',
      certificate: null,
      wing: null,
      onboardingComplete: false,
      emailVerified: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    });
    
    return user;
  },
  
  // Login
// ... existing imports

  async login(email, password) {
    const auth = getAuthInstance();
    const db = getDbInstance();
    
    // 1. Sign in normally
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Fetch the role from Firestore FIRST
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const role = userData.role || 'cadet';

    // 3. Conditional Verification Check
    // If user is a cadet, strictly require email verification.
    // If user is an admin/superadmin, allow them to bypass.
    if (role === 'cadet' && !user.emailVerified) {
      await this.logout();
      return { status: 'unverified', user };
    }

    // 4. Update last login
    await setDoc(doc(db, 'users', user.uid), {
      lastLoginAt: serverTimestamp(),
      // Ensure Firestore also records them as verified if we are bypassing
      emailVerified: user.emailVerified || (role === 'admin' || role === 'superadmin')
    }, { merge: true });

    return { status: 'success', user };
  },
  
// Admin login
  async adminLogin(email, password) {
    const auth = getAuthInstance();
         
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
         
    // Check if user is admin via Firestore instead of claims
    const db = getDbInstance();
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    let role = 'cadet';
    if (userDoc.exists()) {
      role = userDoc.data().role;
    }
         
    if (role !== 'admin' && role !== 'superadmin') {
      await this.logout();
      throw new Error('Unauthorized access');
    }
         
    return userCredential.user;
  },
  // Logout
  async logout() {
    const auth = getAuthInstance();
    await signOut(auth);
    Store.reset();
  },
  
  // Get user profile
  async getProfile(uid) {
    try {
      const db = getDbInstance();
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
      }
    } catch (error) {
      console.warn('[AuthService] Profile fetch warning:', error.message);
    }
    
    return null;
  },
  
  // Update profile
  async updateProfile(uid, data) {
    const db = getDbInstance();
    await setDoc(doc(db, 'users', uid), data, { merge: true });
    
    // Update store
    const profile = await this.getProfile(uid);
    Store.set('profile', profile);
    
    return profile;
  },
  
  // Complete onboarding
  async completeOnboarding(uid, certificate, wing) {
    const db = getDbInstance();
    await setDoc(doc(db, 'users', uid), {
      certificate: certificate,
      wing: wing,
      onboardingComplete: true,
      emailVerified: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update store
    const profile = await this.getProfile(uid);
    Store.set('profile', profile);
    
    return profile;
  },
  
  // Check if email is verified
  async checkEmailVerification() {
    if (!this.currentUser) return false;
    
    await reload(this.currentUser);
    return this.currentUser.emailVerified;
  },
  
  // Send password reset email
  async resetPassword(email) {
    const auth = getAuthInstance();
    await sendPasswordResetEmail(auth, email);
  },
  
  // Get current user
  getCurrentUser() {
    return this.currentUser;
  },
  
  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null;
  }
};

// Export
export default AuthService;