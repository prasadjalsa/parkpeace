// OneSignal Web SDK v16 wrapper
// The SDK is loaded via <script> tag in index.html

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: OneSignalAPI) => void>
  }
}

interface OneSignalAPI {
  init(config: { appId: string; notifyButton?: { enable: boolean } }): Promise<void>
  login(externalId: string): void
  logout(): void
  Slidedown: {
    promptPush(): Promise<void>
  }
  User: {
    PushSubscription: {
      id: string | null
      optedIn: boolean
    }
  }
}

function push(fn: (os: OneSignalAPI) => void) {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(fn)
}

export function initOneSignal(appId: string) {
  push(async (os) => {
    await os.init({ appId, notifyButton: { enable: false } })
  })
}

export function loginOneSignal(userId: string) {
  push((os) => os.login(userId))
}

export function logoutOneSignal() {
  push((os) => os.logout())
}

export function promptPushPermission() {
  push((os) => os.Slidedown.promptPush())
}
