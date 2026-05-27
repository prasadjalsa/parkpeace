// Generates public/firebase-messaging-sw.js from environment variables at build time.
// Runs before `vite build` so the service worker is created fresh on every Vercel deploy.

import { writeFileSync } from 'fs'

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error('Missing env vars for service worker:', missing.join(', '))
  process.exit(1)
}

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const content = `importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

firebase.initializeApp(${JSON.stringify(config, null, 2)})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'ParkPeace Alert'
  const body = payload.notification?.body ?? ''
  const chatUrl = payload.data?.chatUrl ?? null

  self.registration.showNotification(title, {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { chatUrl },
  })

  // Set app icon badge — try both forms for iOS PWA compatibility
  try {
    if (navigator.setAppBadge) {
      navigator.setAppBadge(1)
    } else if (self.navigator?.setAppBadge) {
      self.navigator.setAppBadge(1)
    }
  } catch (_) {}
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.chatUrl ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('navigate' in w && 'focus' in w) {
          return w.focus().then(() => w.navigate(targetUrl))
        }
      }
      return clients.openWindow(targetUrl)
    })
  )
})
`

writeFileSync('public/firebase-messaging-sw.js', content)
console.log('✓ firebase-messaging-sw.js generated from env vars')
