import { useState } from 'react'
import { Save, Bell, BellOff } from 'lucide-react'
import type { Profile } from '../../hooks/useProfile'
import { requestFCMToken } from '../../lib/firebase'

interface Props {
  profile: Profile | null
  onSave: (updates: Partial<Omit<Profile, 'id'>>) => Promise<{ error: { message: string } | null | undefined }>
}

export function ProfileForm({ profile, onSave }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number ?? '')
  const [emergencyName, setEmergencyName] = useState(profile?.emergency_name ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_phone ?? '')
  const [emergencyRel, setEmergencyRel] = useState(profile?.emergency_rel ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notifStatus, setNotifStatus] = useState<'idle' | 'enabling' | 'enabled' | 'denied'>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'enabled' : 'idle'
  )
  const [notifError, setNotifError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { setError('Your phone number is required.'); return }
    setSaving(true)
    setError(null)
    const { error } = await onSave({
      full_name: fullName.trim() || null,
      phone: phone.trim(),
      whatsapp_number: whatsapp.trim() || null,
      emergency_name: emergencyName.trim() || null,
      emergency_phone: emergencyPhone.trim() || null,
      emergency_rel: emergencyRel.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleEnableNotifications() {
    setNotifStatus('enabling')
    setNotifError(null)
    const result = await requestFCMToken()
    if ('token' in result) {
      await onSave({ fcm_token: result.token })
      setNotifStatus('enabled')
    } else {
      setNotifError(result.error)
      setNotifStatus(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'denied' : 'idle')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Your Contact Details</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Priya Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Your Phone Number <span className="text-red-500">*</span></label>
            <input
              type="tel"
              className="input"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">Shown on the call dialer when someone contacts you.</p>
          </div>
          <div>
            <label className="label">WhatsApp Number</label>
            <input
              type="tel"
              className="input"
              placeholder="+91 98765 43210"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">When someone contacts you, their WhatsApp will open with a pre-filled message. Your number is never shown to them.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Emergency Contact</h2>
        <p className="text-xs text-gray-400 mb-4">If someone presses Emergency, their phone will call this number.</p>
        <div className="space-y-4">
          <div>
            <label className="label">Contact Name</label>
            <input type="text" className="input" placeholder="e.g. Rahul Sharma"
              value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
          </div>
          <div>
            <label className="label">Contact Phone</label>
            <input type="tel" className="input" placeholder="+91 91234 56789"
              value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Relationship</label>
            <input type="text" className="input" placeholder="e.g. Spouse, Parent, Friend"
              value={emergencyRel} onChange={(e) => setEmergencyRel(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Push Notifications</h2>
            <p className="text-xs text-gray-400 mt-0.5">Get notified when someone scans your QR (via Firebase). On iPhone, add this site to your Home Screen first.</p>
          </div>
          {notifStatus === 'enabled' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1.5 rounded-full">
              <Bell className="w-3.5 h-3.5" /> Enabled
            </span>
          ) : notifStatus === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
              <BellOff className="w-3.5 h-3.5" /> Blocked
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={notifStatus === 'enabling'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
            >
              <Bell className="w-3.5 h-3.5" />
              {notifStatus === 'enabling' ? 'Enabling…' : 'Enable'}
            </button>
          )}
        </div>
        {notifStatus === 'denied' && (
          <p className="text-xs text-red-500 mt-2">
            Notifications are blocked. Allow them in your browser settings and reload.
          </p>
        )}
        {notifError && (
          <p className="text-xs text-red-500 mt-2 break-all">{notifError}</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        <Save className="w-4 h-4" />
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Profile'}
      </button>
    </form>
  )
}
