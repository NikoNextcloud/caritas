import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { AdminUser } from '@/types'

export async function login(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password)
  // Mark user as online
  await setDoc(doc(db, 'users', result.user.uid), { isOnline: true }, { merge: true })
  return result.user
}

export async function logout() {
  if (auth.currentUser) {
    await setDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false }, { merge: true })
  }
  await signOut(auth)
}

export async function setOnlineStatus(isOnline: boolean) {
  if (!auth.currentUser) return
  await setDoc(doc(db, 'users', auth.currentUser.uid), { isOnline }, { merge: true })
}

export async function getAdminUser(uid: string): Promise<AdminUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { uid, ...snap.data() } as AdminUser
}

export function onAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
