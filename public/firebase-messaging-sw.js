// Firebase Cloud Messaging Service Worker
// Required for background push notifications.
// This file must be at: https://yourdomain.com/firebase-messaging-sw.js
//
// IMPORTANT: Replace ALL placeholder values below with your actual Firebase project config.
// Find them in: Firebase Console → Project Settings → Your Apps → Web app config

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

// TODO: Replace with your actual Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyDpyiFs-vnoRL4JHfnwKL8fWlddlif3GlY",
  authDomain: "parkpeace.firebaseapp.com",
  projectId: "parkpeace",
  storageBucket: "parkpeace.firebasestorage.app",
  messagingSenderId: "705352736209",
  appId: "1:705352736209:web:dd3a865d71caa287c754f0",
})

const messaging = firebase.messaging()

// Handle notifications when the app is in the background or closed
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'ParkPeace Alert'
  const body = payload.notification?.body ?? ''
  self.registration.showNotification(title, {
    body,
    icon: '/car-icon.svg',
    badge: '/car-icon.svg',
  })
})
