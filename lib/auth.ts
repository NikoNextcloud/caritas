import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'
import { auth } from './firebase'
import { getAppDocument, upsertAppDocument } from './app-data'
import type { AdminUser } from '@/types'

let presenceOnline = false
let presenceHeartbeatAt = 0

export async function login(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function logout() {
  if (auth.currentUser) {
    await setOnlineStatus(false)
  }
  await signOut(auth)
}

export async function setOnlineStatus(isOnline: boolean, displayName?: string) {
  if (!auth.currentUser) return
  presenceOnline = isOnline
  presenceHeartbeatAt = Date.now()
  await upsertAppDocument('presence', auth.currentUser.uid, {
    uid: auth.currentUser.uid,
    displayName: displayName || auth.currentUser.displayName || auth.currentUser.email || 'Потребител',
    isOnline,
    lastSeen: new Date(presenceHeartbeatAt).toISOString(),
  })
}

export function startPresenceTracking(displayName: string) {
  const idleAfterMs = 5 * 60_000
  const heartbeatEveryMs = 2 * 60_000
  let lastActivity = Date.now()
  let lastHeartbeat = presenceHeartbeatAt
  let online = presenceOnline

  const publish = (isOnline: boolean) => {
    online = isOnline
    lastHeartbeat = Date.now()
    presenceOnline = isOnline
    presenceHeartbeatAt = lastHeartbeat
    void setOnlineStatus(isOnline, displayName).catch(() => {})
  }

  const markActive = () => {
    lastActivity = Date.now()
    if (!online) publish(true)
  }

  const tick = () => {
    const current = Date.now()
    if (current - lastActivity >= idleAfterMs) {
      if (online) publish(false)
      return
    }
    if (!online || current - lastHeartbeat >= heartbeatEveryMs) publish(true)
  }

  const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart']
  activityEvents.forEach(event => window.addEventListener(event, markActive, { passive: true }))
  const onVisibility = () => { if (document.visibilityState === 'visible') markActive() }
  const onPageHide = () => publish(false)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)

  if (!online || Date.now() - lastHeartbeat >= heartbeatEveryMs) publish(true)
  const timer = window.setInterval(tick, 30_000)

  return () => {
    window.clearInterval(timer)
    activityEvents.forEach(event => window.removeEventListener(event, markActive))
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
  }
}

export async function getAdminUser(uid: string): Promise<AdminUser | null> {
  const user = await getAppDocument<AdminUser>('users', uid)
  return user ? { ...user, uid } : null
}

export function onAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
