import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDnGQB75UZG3XWhQfsqm57B36_s18rT-rc",
  authDomain: "l2p-kyc.firebaseapp.com",
  projectId: "l2p-kyc",
  storageBucket: "l2p-kyc.firebasestorage.app",
  messagingSenderId: "787783206578",
  appId: "1:787783206578:web:7f279ff5df073954416bab",
  measurementId: "G-S9NS3VMCTM"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// Initialize storage
// getStorage accepts the bucket name directly (without gs:// prefix)
let storage
try {
  // Initialize with explicit bucket name from config
  storage = getStorage(app, firebaseConfig.storageBucket)
  console.log('Firebase Storage initialized with bucket:', firebaseConfig.storageBucket)
} catch (error) {
  console.warn('Failed to initialize with bucket name, using default storage:', error)
  // Fallback to default storage (uses bucket from config automatically)
  storage = getStorage(app)
  console.log('Firebase Storage initialized with default bucket')
}

export { storage }
export default app
