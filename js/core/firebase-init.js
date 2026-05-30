// filepath: js/core/firebase-init.js
// Firebase App Initialization for NCC Cadet Learning Platform

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  getStorage, 
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

// Firebase Configuration - Replace with your project config
const firebaseConfig = {
  apiKey: "AIzaSyCn_WXWKO1KJ-VF0CuxlHItDpWlqBb2H68",
  authDomain: "ncc-cadet-platform.firebaseapp.com",
  projectId: "ncc-cadet-platform",
  storageBucket: "ncc-cadet-platform.firebasestorage.app",
  messagingSenderId: "446822209995",
  appId: "1:446822209995:web:2dc7ec4220301fb080be4e"
};
initializeApp(firebaseConfig);
// Initialize Firebase
let app, auth, db, storage, functions;

function initFirebase() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app);
  }
  return { app, auth, db, storage, functions };
}

// Get auth instance
function getAuthInstance() {
  initFirebase();
  return auth;
}

// Get firestore instance
function getDbInstance() {
  initFirebase();
  return db;
}

// Get storage instance
function getStorageInstance() {
  initFirebase();
  return storage;
}

// Get functions instance
function getFunctionsInstance() {
  initFirebase();
  return functions;
}

// Set auth persistence
async function setAuthPersistence(userType = 'cadet') {
  const auth = getAuthInstance();
  const persistence = userType === 'admin' 
    ? browserSessionPersistence 
    : browserLocalPersistence;
  await setPersistence(auth, persistence);
}

let currentAuthListener = null;
let cachedAuthData = undefined;
let authCallbacks = [];
let authReadyResolver;
let authReadyPromise = new Promise((resolve) => {
  authReadyResolver = resolve;
});

// Listen to auth state changes
// Listen to auth state changes
function onAuthChange(callback) {
  const auth = getAuthInstance();
  const db = getDbInstance(); // Ensure we have the DB instance

  if (!currentAuthListener) {
    currentAuthListener = onAuthStateChanged(auth, async (user) => {
      if (user) {
        
        let role = 'cadet';
        let twoFactorVerified = false;

        try {
          // Instead of checking the token claims, we query Firestore directly!
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            role = userDoc.data().role || 'cadet';
          }
        } catch (error) {
          console.error("Failed to fetch user role from Firestore:", error);
        }
                 
        cachedAuthData = {
          user,
          role,
          twoFactorVerified,
          emailVerified: user.emailVerified
        };
      } else {
        cachedAuthData = null;
      }

      if (authReadyResolver) {
        authReadyResolver(cachedAuthData);
        authReadyResolver = null;
      }
             
      authCallbacks.forEach(cb => cb(cachedAuthData));
    });
  }

  if (cachedAuthData !== undefined) {
    callback(cachedAuthData);
  }

  authCallbacks.push(callback);

  return () => {
    authCallbacks = authCallbacks.filter(cb => cb !== callback);
  };
}

function waitForAuthReady() {
  return authReadyPromise;
}

function getCachedAuthData() {
  return cachedAuthData;
}

function clearAuthCallbacks() {
  authCallbacks = [];
}

// Sign out
async function signOut() {
  const auth = getAuthInstance();
  await firebaseSignOut(auth);
}

// Export all functions
export {
  initFirebase,
  getAuthInstance,
  getDbInstance,
  getStorageInstance,
  getFunctionsInstance,
  setAuthPersistence,
  onAuthChange,
  waitForAuthReady,
  getCachedAuthData,
  clearAuthCallbacks,
  signOut,
  // Firestore helpers
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  getCountFromServer,
  // Storage helpers
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  // Functions helpers
  httpsCallable
};