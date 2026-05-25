import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen, UserPlus, Bell, HelpCircle, Layers, X, Smartphone } from 'lucide-react'

type Section = 'howto' | 'register' | 'notifications' | 'homescreen' | 'faq' | 'buildplan'

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'howto', label: 'How to Use', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'register', label: 'How to Register', icon: <UserPlus className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'homescreen', label: 'Add to Home Screen', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'buildplan', label: 'Build Plan', icon: <Layers className="w-4 h-4" /> },
]

function SectionContent({ id }: { id: Section }) {
  switch (id) {
    case 'howto':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p><strong>1. Register</strong> — Create a free account with your email and password on the sign-in page.</p>
          <p><strong>2. Set up your profile</strong> — Tap the <strong>profile button</strong> (your name, top-right) on the dashboard to open Profile. Add your full name, phone number, WhatsApp number, and emergency contact. Tap <strong>Edit</strong> to make changes, then <strong>Save Profile</strong>.</p>
          <p><strong>3. Enable notifications</strong> — In Profile, tap <strong>Enable</strong> in the Push Notifications section and allow the browser prompt. You'll get instant alerts when someone scans your QR.</p>
          <p><strong>4. Add a vehicle</strong> — Go to the <strong>My Vehicles</strong> tab and tap <strong>Add Vehicle</strong>. Give it a name (e.g. "Red Swift"). A QR code is generated automatically.</p>
          <p><strong>5. Print &amp; place the QR</strong> — Download the QR as a PNG, print it, and place it on your dashboard or windshield.</p>
          <p><strong>6. Get notified</strong> — When someone scans your QR and submits the contact form, you receive a push notification. If you have a WhatsApp number saved, the scanner's WhatsApp will also open with a pre-filled message.</p>
          <p><strong>7. View scan history</strong> — See all events in the <strong>Scan History</strong> tab, or tap the clock icon on any vehicle card to see that vehicle's history. Use <strong>Clear History</strong> to delete events by date range.</p>
        </div>
      )
    case 'register':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p><strong>1.</strong> On the sign-in page, click the <strong>Register</strong> tab.</p>
          <p><strong>2.</strong> Enter your email address and choose a password (min. 6 characters). Tap the eye icon to show or hide it.</p>
          <p><strong>3.</strong> Re-enter the same password in the <strong>Confirm Password</strong> field — a green "Passwords match ✓" indicator confirms they are identical. The Create Account button stays disabled until they match.</p>
          <p><strong>4.</strong> Click <strong>Create Account</strong>. You'll be switched to Sign In automatically.</p>
          <p><strong>5.</strong> Sign in with the same email and password.</p>
          <p><strong>6.</strong> Tap the <strong>profile button</strong> (your name, top-right) to open Profile. Click <strong>Edit</strong> and fill in:</p>
          <ul className="list-disc list-inside ml-3 space-y-1">
            <li>Full Name</li>
            <li>Phone Number (required)</li>
            <li>WhatsApp Number (optional — lets scanners message you via WhatsApp)</li>
            <li>Emergency Contact name, phone, and relationship</li>
          </ul>
          <p><strong>7.</strong> Click <strong>Save Profile</strong>, then enable push notifications.</p>
        </div>
      )
    case 'notifications':
      return (
        <div className="space-y-4 text-sm text-gray-600">
          <p>ParkPeace uses Firebase Cloud Messaging (FCM) to deliver instant push notifications to your device.</p>

          <div>
            <p className="font-semibold text-gray-800 mb-1">Steps (all devices)</p>
            <p><strong>1.</strong> Sign in and tap your name (top right) to open Profile.</p>
            <p><strong>2.</strong> In the <strong>Push Notifications</strong> section, tap <strong>Enable</strong>.</p>
            <p><strong>3.</strong> When the browser asks for permission, tap <strong>Allow</strong>.</p>
            <p><strong>4.</strong> The button turns green — notifications are active on this device.</p>
            <p className="text-xs text-gray-400 mt-1">Each device must enable notifications separately. The token is tied to the browser and device.</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-blue-800 text-xs">Android (Chrome / Samsung Browser)</p>
            <p className="text-xs text-blue-700">Works directly in the browser — no extra setup needed. Tap Enable in Profile and allow when prompted. Notifications arrive even when the browser is in the background.</p>
            <p className="text-xs text-blue-600 mt-1">For the best experience, also add the app to your Home Screen (see the Add to Home Screen tab).</p>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-amber-800 text-xs">iPhone / iPad (iOS)</p>
            <p className="text-xs text-amber-700">Requires iOS 16.4+ and the app must be added to your Home Screen first:</p>
            <p className="text-xs text-amber-700"><strong>1.</strong> Open the site in <strong>Safari</strong> (not Chrome).</p>
            <p className="text-xs text-amber-700"><strong>2.</strong> Tap the Share button → <strong>Add to Home Screen</strong>.</p>
            <p className="text-xs text-amber-700"><strong>3.</strong> Open the app from your Home Screen.</p>
            <p className="text-xs text-amber-700"><strong>4.</strong> Go to Profile → tap <strong>Enable</strong> notifications.</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-gray-700 text-xs">Mac / Windows (Chrome or Edge)</p>
            <p className="text-xs text-gray-600">Works in the browser. If notifications don't appear after enabling:</p>
            <p className="text-xs text-gray-600">• <strong>Mac:</strong> System Settings → Notifications → Google Chrome → Allow</p>
            <p className="text-xs text-gray-600">• <strong>Windows:</strong> Settings → System → Notifications → Chrome → On</p>
            <p className="text-xs text-gray-600">• Make sure Focus / Do Not Disturb mode is off.</p>
          </div>
        </div>
      )
    case 'homescreen':
      return (
        <div className="space-y-4 text-sm text-gray-600">
          <p>Adding ParkPeace to your Home Screen makes it behave like a native app — full screen, no browser bars, faster to open, and required for notifications on iPhone.</p>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide">iPhone / iPad — Safari</p>
            <p className="text-xs text-gray-600"><strong>1.</strong> Open the site in <strong>Safari</strong> (must be Safari, not Chrome).</p>
            <p className="text-xs text-gray-600"><strong>2.</strong> Tap the <strong>Share</strong> icon at the bottom of the screen (box with an arrow pointing up).</p>
            <p className="text-xs text-gray-600"><strong>3.</strong> Scroll down and tap <strong>Add to Home Screen</strong>.</p>
            <p className="text-xs text-gray-600"><strong>4.</strong> Tap <strong>Add</strong> in the top right — the ParkPeace icon appears on your Home Screen.</p>
            <p className="text-xs text-gray-600"><strong>5.</strong> Open it from there and enable notifications in Profile.</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Android — Chrome</p>
            <p className="text-xs text-gray-600"><strong>1.</strong> Open the site in <strong>Chrome</strong>.</p>
            <p className="text-xs text-gray-600"><strong>2.</strong> Tap the <strong>⋮ menu</strong> (three dots, top right).</p>
            <p className="text-xs text-gray-600"><strong>3.</strong> Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</p>
            <p className="text-xs text-gray-600"><strong>4.</strong> Tap <strong>Add</strong> — the icon appears on your Home Screen.</p>
            <p className="text-xs text-gray-600">Alternatively, Chrome may show an <strong>Install</strong> banner or icon in the address bar — tap it.</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Android — Samsung Internet</p>
            <p className="text-xs text-gray-600"><strong>1.</strong> Open the site in Samsung Internet.</p>
            <p className="text-xs text-gray-600"><strong>2.</strong> Tap the <strong>☰ menu</strong> (bottom right).</p>
            <p className="text-xs text-gray-600"><strong>3.</strong> Tap <strong>Add page to</strong> → <strong>Home screen</strong>.</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Desktop — Chrome or Edge</p>
            <p className="text-xs text-gray-600"><strong>1.</strong> Look for an <strong>Install</strong> icon (⊕) in the address bar on the right.</p>
            <p className="text-xs text-gray-600"><strong>2.</strong> Click it and confirm <strong>Install</strong>.</p>
            <p className="text-xs text-gray-600">Or: Click <strong>⋮ menu</strong> → <strong>Save and share</strong> → <strong>Install page as app</strong>.</p>
            <p className="text-xs text-gray-600">The app opens in its own window without browser toolbars.</p>
          </div>
        </div>
      )
    case 'faq':
      return (
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">Does the scanner need an account?</p>
            <p className="mt-1">No. Anyone who scans the QR code can contact you without signing in.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Is my phone or WhatsApp number shown to the scanner?</p>
            <p className="mt-1">No. Both numbers are hidden. The scanner never sees them — the server returns the WhatsApp number only after the notification is sent, and only to open WhatsApp on the scanner's phone.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What happens when Contact Owner is submitted?</p>
            <p className="mt-1">A push notification is sent to your device instantly. If you have a WhatsApp number saved, the scanner's WhatsApp opens with a pre-filled message including their name, number, and message. Both happen with a single button tap.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What happens when Emergency is used?</p>
            <p className="mt-1">The event is logged, you receive a push notification, and the scanner's phone opens the dialer to call your emergency contact directly. No server cost — the call is made from the scanner's own phone.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Can I have multiple vehicles?</p>
            <p className="mt-1">Yes. Add one QR code per vehicle in the My Vehicles tab. Each has its own scan history.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">How do I see who contacted me for a specific car?</p>
            <p className="mt-1">Tap the clock icon on any vehicle card in My Vehicles to see that vehicle's scan history in a popup.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">How do I clear old scan history?</p>
            <p className="mt-1">Open Scan History (or a vehicle's history), tap <strong>Clear History</strong>, set a date range, and confirm. Only events within that range are deleted.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Is this free?</p>
            <p className="mt-1">Yes, completely free. It runs on Supabase, Firebase, and Vercel free tiers with no credit card required.</p>
          </div>
        </div>
      )
    case 'buildplan':
      return (
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-1">Tech Stack</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Frontend: React + TypeScript + Vite + Tailwind CSS</li>
              <li>Auth &amp; Database: Supabase (PostgreSQL + Row Level Security)</li>
              <li>Push Notifications: Firebase Cloud Messaging (FCM v1 API)</li>
              <li>Backend Logic: Supabase Edge Functions (Deno)</li>
              <li>Hosting: Vercel (auto-deploy from GitHub)</li>
              <li>QR Generation: qrcode.react (client-side, no server needed)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Features</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Owner dashboard: profile, multiple vehicles, scan history</li>
              <li>Profile view/edit mode — shows saved values, edit button to modify</li>
              <li>Profile accessible via a styled clickable button (name + icon) in the header</li>
              <li>Register: confirm password field with live match indicator; eye icon to show/hide password</li>
              <li>Unread scan badge on Scan History tab + app icon badge via Web Badge API</li>
              <li>WhatsApp integration — scanner's WhatsApp opens with pre-filled message</li>
              <li>Scanner page: contact form with name, phone, message</li>
              <li>Emergency flow: push alert to owner + scanner's phone dials emergency contact</li>
              <li>Per-vehicle scan history with clock icon on each card</li>
              <li>Clear scan history by custom date range</li>
              <li>Help &amp; Documentation panel accessible from every page header</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Key Design Decisions</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Scanner page is fully public — no login required</li>
              <li>Owner's phone and WhatsApp number never exposed to scanner</li>
              <li>WhatsApp number returned by Edge Function only after notification is sent</li>
              <li>Emergency uses scanner's own phone to dial (free — no Twilio)</li>
              <li>Firebase service worker generated at build time from env vars (no API keys in git)</li>
              <li>FCM JWT signing done in Edge Function using RSA/RS256 — no third-party auth library needed</li>
              <li>Foreground push messages handled in main thread; background via service worker</li>
              <li>RLS policies ensure owners can only read and delete their own data</li>
              <li>GitHub Actions deploys Edge Functions — no local Supabase CLI needed</li>
            </ul>
          </div>
          <div className="bg-primary-50 rounded-lg p-3">
            <p className="font-semibold text-primary-800 text-xs">Total server cost: $0</p>
            <p className="text-primary-700 text-xs mt-0.5">Future enhancement: bridge calls via Twilio (connect scanner + owner via server-side call).</p>
          </div>
        </div>
      )
  }
}

function HelpPanelContent() {
  const [active, setActive] = useState<Section>('howto')
  return (
    <>
      <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 shrink-0">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors shrink-0 border-b-2 ${
              active === s.id
                ? 'border-primary-600 text-primary-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>
      <div className="p-4 overflow-y-auto">
        <SectionContent id={active} />
      </div>
    </>
  )
}

// ── Modal version — used in page headers ─────────────────────────────────────

export function HelpButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        aria-label="Help & Documentation"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary-600" />
                <h2 className="font-semibold text-gray-900">Help &amp; Documentation</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <HelpPanelContent />
          </div>
        </div>
      )}
    </>
  )
}

// ── Collapsible version — used on the auth/sign-in page ──────────────────────

export function HelpSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full max-w-md mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-600"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Help &amp; Documentation
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <HelpPanelContent />
        </div>
      )}
    </div>
  )
}
