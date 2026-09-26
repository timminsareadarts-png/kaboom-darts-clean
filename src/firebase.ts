import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, setLogLevel, disableNetwork } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Silence internal Firestore SDK retry and warning logs
try {
  setLogLevel('silent');
} catch (e) {}

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with memory cache (avoids stale queued offline retry storms on quota exhaustion)
export const db = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? initializeFirestore(app, { localCache: memoryLocalCache() }, firebaseConfigJson.firestoreDatabaseId)
  : initializeFirestore(app, { localCache: memoryLocalCache() });

// Ensure network is enabled
try {
  if (typeof window !== 'undefined') {
    const quotaCooloff = localStorage.getItem('kaboom_firestore_quota_exhausted_until');
    if (quotaCooloff && Number(quotaCooloff) <= Date.now()) {
      localStorage.removeItem('kaboom_firestore_quota_exhausted_until');
    }
  }
} catch (e) {}

