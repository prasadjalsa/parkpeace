import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen, UserPlus, Bell, HelpCircle, Layers } from 'lucide-react'

type Section = 'howto' | 'register' | 'notifications' | 'faq' | 'buildplan'

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'howto', label: 'How to Use', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'register', label: 'How to Register', icon: <UserPlus className="w-4 h-4" /> },
  { id: 'notifications', label: 'Turn On Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'buildplan', label: 'Build Plan', icon: <Layers className="w-4 h-4" /> },
]

function SectionContent({ id }: { id: Section }) {
  switch (id) {
    case 'howto':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p><strong>1. Register</strong> — Create a free account with your email and password.</p>
          <p><strong>2. Set up your profile</strong> — Add your name, phone number, and an emergency contact. Tap your name in the dashboard header to open Profile.</p>
          <p><strong>3. Add a vehicle</strong> — In the My Vehicles tab, tap Add Vehicle and give it a name (e.g. "Red Swift"). A QR code is generated automatically.</p>
          <p><strong>4. Print &amp; place the QR</strong> — Download the QR as a PNG, print it, and place it on your dashboard or windshield.</p>
          <p><strong>5. Get notified</strong> — When someone scans your QR, they can send you a message or trigger an emergency call. You receive a push notification instantly.</p>
        </div>
      )
    case 'register':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p><strong>1.</strong> Click the <strong>Register</strong> tab above.</p>
          <p><strong>2.</strong> Enter your email address and choose a password (min. 6 characters).</p>
          <p><strong>3.</strong> Click <strong>Create Account</strong>. You'll be switched to Sign In automatically.</p>
          <p><strong>4.</strong> Sign in with the same email and password.</p>
          <p><strong>5.</strong> Complete your profile — tap your name in the top-right corner of the dashboard and fill in your phone and emergency contact details.</p>
        </div>
      )
    case 'notifications':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p>ParkPeace uses Firebase Cloud Messaging (FCM) to send push notifications to your browser.</p>
          <p><strong>Steps:</strong></p>
          <p><strong>1.</strong> Sign in and go to your dashboard.</p>
          <p><strong>2.</strong> Tap your name (top right) to open Profile.</p>
          <p><strong>3.</strong> In the <strong>Push Notifications</strong> section, tap <strong>Enable</strong>.</p>
          <p><strong>4.</strong> When your browser asks for permission, click <strong>Allow</strong>.</p>
          <p><strong>5.</strong> The button turns green — notifications are now active.</p>
          <p className="text-amber-700 bg-amber-50 rounded-lg p-2"><strong>iPhone:</strong> Notifications only work on Safari iOS 16.4+ when the site is added to your Home Screen. Open the site in Safari → Share → Add to Home Screen, then enable notifications.</p>
        </div>
      )
    case 'faq':
      return (
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">Does the scanner need an account?</p>
            <p className="mt-1">No. Anyone with the QR code link can contact you without signing in.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Is my phone number visible to the scanner?</p>
            <p className="mt-1">No. Your phone number is never shown to the scanner. Only you see it in your profile.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What happens when Emergency is used?</p>
            <p className="mt-1">The event is logged, you receive a push notification, and the scanner's phone opens the dialer to call your emergency contact directly.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Can I have multiple vehicles?</p>
            <p className="mt-1">Yes. Add one QR code per vehicle in the My Vehicles tab.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">What if I don't receive notifications?</p>
            <p className="mt-1">Make sure you clicked Enable in your Profile and allowed browser notifications. On Mac, check System Settings → Notifications → Chrome is enabled.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Is this free?</p>
            <p className="mt-1">Yes, completely free. It runs on Supabase, Firebase, and Vercel free tiers.</p>
          </div>
        </div>
      )
    case 'buildplan':
      return (
        <div className="space-y-3 text-sm text-gray-600">
          <p><strong>Stack</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Frontend: React + TypeScript + Vite + Tailwind CSS</li>
            <li>Auth &amp; Database: Supabase (PostgreSQL + Row Level Security)</li>
            <li>Push Notifications: Firebase Cloud Messaging (FCM v1)</li>
            <li>Backend Logic: Supabase Edge Functions (Deno)</li>
            <li>Hosting: Vercel (auto-deploy from GitHub)</li>
            <li>QR Generation: qrcode.react (client-side, no server needed)</li>
          </ul>
          <p><strong>Key Design Decisions</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Scanner page is fully public — no login required</li>
            <li>Emergency uses the scanner's own phone to dial (free, no Twilio)</li>
            <li>Firebase service worker generated at build time from env vars (no keys in git)</li>
            <li>RLS policies ensure owners only see their own data</li>
          </ul>
          <p><strong>Total server cost: $0</strong></p>
          <p><strong>Future enhancement:</strong> Bridge calls via Twilio (connect scanner + owner via server-side call)</p>
        </div>
      )
  }
}

export function HelpSection() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Section>('howto')

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
          {/* Section tabs */}
          <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50">
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
          <div className="p-4">
            <SectionContent id={active} />
          </div>
        </div>
      )}
    </div>
  )
}
