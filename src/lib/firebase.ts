import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

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

export { onMessage }
