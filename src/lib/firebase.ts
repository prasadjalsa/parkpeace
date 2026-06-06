import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

// One-time migration: clears corrupted Firebase Installations IndexedDB state
// left behind by the FCM API outage + version rollback on 2026-06-06.
// Runs once per browser profile, gates itself with localStorage.
export async function clearCorruptedFCMState(): Promise<void> {
  const CLEARED_KEY = 'fcm_idb_cleared_20260606'
  if (localStorage.getItem(CLEARED_KEY)) return
  try {
    // Unregister any stale service worker for this scope
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        if (reg.scope.includes(window.location.origin)) {
          await reg.unregister()
        }
      }
    }
    // Delete Firebase Installations and Messaging IndexedDB databases
    const dbsToClear = ['firebase-installations-database', 'firebase-messaging-database']
    await Promise.allSettled(
      dbsToClear.map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(name)
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
            req.onblocked = () => resolve() // treat blocked as non-fatal
          })
      )
    )
    localStorage.setItem(CLEARED_KEY, '1')
  } catch (_) {
    // Non-fatal: token registration will surface its own error if still broken
  }
}
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null

export async function requestFCMToken(): Promise<{ token: string } | { error: string }> {
  if (!messaging) return { error: 'Firebase Messaging not available in this browser.' }
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return { error: 'No token returned — check VAPID key and notification permission.' }
    return { token }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('FCM token error:', err)
    return { error: msg }
  }
}

// Called once from DashboardPage to handle foreground push messages.
// Sets the app icon badge and dispatches a custom event so the unread count updates.
export function initForegroundMessaging() {
  if (!messaging) return
  onMessage(messaging, () => {
    navigator.setAppBadge?.(1)
    window.dispatchEvent(new Event('parkpeace:new-scan'))
  })
}
