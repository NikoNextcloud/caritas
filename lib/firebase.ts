import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyAyZJkgwGCN3AE7kbZuU_VKlAvskT1R4Wk",
  authDomain: "caritas-vitania.firebaseapp.com",
  databaseURL: "https://caritas-vitania-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "caritas-vitania",
  storageBucket: "caritas-vitania.firebasestorage.app",
  messagingSenderId: "984069491074",
  appId: "1:984069491074:web:ebf3bd258539a2e7d8679b",
  measurementId: "G-VPJFE2EXWD"
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const rtdb = getDatabase(app) // Realtime Database (за нотификации)

// Analytics само в browser
if (typeof window !== 'undefined') {
  isSupported().then(yes => { if (yes) getAnalytics(app) })
}

export default app
