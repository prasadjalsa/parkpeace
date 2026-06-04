import { useEffect, useState } from 'react'
import { Save, Bell, BellOff, Pencil, X, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react'
import type { Profile } from '../../hooks/useProfile'
import { requestFCMToken } from '../../lib/firebase'
import { supabase } from '../../lib/supabase'

interface Props {
  profile: Profile | null
  onSave: (updates: Partial<Omit<Profile, 'id'>>) => Promise<{ error: { message: string } | null | undefined }>
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value?.trim() || <span className="text-gray-300 font-normal">—</span>}</p>
    </div>
  )
}

export function ProfileForm({ profile, onSave }: Props) {
  const [editing, setEditing] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false)
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRel, setEmergencyRel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notifStatus, setNotifStatus] = useState<'idle' | 'enabling' | 'enabled' | 'denied'>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'enabled' : 'idle'
  )
  const [notifError, setNotifError] = useState<string | null>(null)
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaOtp, setMfaOtp] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaChallengeId, setMfaChallengeId] = useState('')
  const [mfaStage, setMfaStage] = useState<'idle' | 'verify' | 'done'>('idle')
  const [mfaError, setMfaError] = useState('')
  const [mfaSuccess, setMfaSuccess] = useState('')

  // Check if email MFA is already enrolled
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const allFactors = [...(data?.totp ?? []), ...(data?.phone ?? [])]
      const emailFactor = allFactors.find(f => f.factor_type === 'email' && f.status === 'verified')
      setMfaEnrolled(!!emailFactor)
      if (emailFactor) setMfaFactorId(emailFactor.id)
    })
  }, [])

  async function handleEnrol2FA() {
    setMfaLoading(true)
    setMfaError('')
    setMfaSuccess('')
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'email' })
    if (error || !data) {
      setMfaError(error?.message ?? 'Failed to start enrolment.')
      setMfaLoading(false)
      return
    }
    setMfaFactorId(data.id)
    // Issue challenge to send OTP email
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: data.id })
    if (challengeErr || !challenge) {
      setMfaError(challengeErr?.message ?? 'Failed to send OTP.')
      setMfaLoading(false)
      return
    }
    setMfaChallengeId(challenge.id)
    setMfaStage('verify')
    setMfaLoading(false)
  }

  async function handleVerify2FA() {
    setMfaLoading(true)
    setMfaError('')
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code: mfaOtp.trim() })
    if (error) {
      setMfaError('Invalid code. Please try again.')
      setMfaLoading(false)
      return
    }
    setMfaEnrolled(true)
    setMfaStage('done')
    setMfaOtp('')
    setMfaSuccess('2FA enabled. You will receive an email OTP on every sign-in.')
    setMfaLoading(false)
  }

  async function handleUnenrol2FA() {
    setMfaLoading(true)
    setMfaError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) {
      setMfaError(error.message)
      setMfaLoading(false)
      return
    }
    setMfaEnrolled(false)
    setMfaFactorId('')
    setMfaStage('idle')
    setMfaSuccess('2FA has been disabled.')
    setMfaLoading(false)
  }
  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name ?? '')
    setPhone(profile.phone ?? '')
    setWhatsapp(profile.whatsapp_number ?? '')
    setWhatsappConfirmed(!!profile.whatsapp_number)
    setEmergencyName(profile.emergency_name ?? '')
    setEmergencyPhone(profile.emergency_phone ?? '')
    setEmergencyRel(profile.emergency_rel ?? '')
  }, [profile])

  function handleCancel() {
    // Reset to saved values
    setFullName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
    setWhatsapp(profile?.whatsapp_number ?? '')
    setWhatsappConfirmed(!!profile?.whatsapp_number)
    setEmergencyName(profile?.emergency_name ?? '')
    setEmergencyPhone(profile?.emergency_phone ?? '')
    setEmergencyRel(profile?.emergency_rel ?? '')
    setError(null)
    setEditing(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { setError('Your full name is required.'); return }
    const digits = phone.replace(/\D/g, '')
    if (!phone.trim()) { setError('Your phone number is required.'); return }
    if (digits.length !== 10) { setError('Phone number must be exactly 10 digits.'); return }
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
    setEditing(false)
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
    <div className="space-y-6">
      {/* Contact Details */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Your Contact Details</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-4">
            <Field label="Full Name" value={profile?.full_name} />
            <Field label="Phone Number" value={profile?.phone} />
            <Field label="WhatsApp Number" value={profile?.whatsapp_number} />
          </div>
        ) : (
          <form id="profile-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input type="text" className="input" placeholder="e.g. Priya Sharma"
                value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone Number <span className="text-red-500">*</span></label>
              <input type="tel" className="input" placeholder="10-digit number e.g. 9876543210"
                value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <p className="text-xs text-gray-400 mt-1">Must be 10 digits. Stored for identification purposes.</p>
            </div>
            <div>
              <label className="label">WhatsApp Number</label>
              {!whatsappConfirmed ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>⚠️ Visibility notice:</strong> When a scanner contacts you via WhatsApp, your number will be visible to them in the WhatsApp chat. Only add your number if you're comfortable with this.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded"
                      checked={whatsappConfirmed}
                      onChange={(e) => setWhatsappConfirmed(e.target.checked)}
                    />
                    <span className="text-xs text-amber-900 font-medium">I understand my number will be visible and want to add it</span>
                  </label>
                </div>
              ) : (
                <>
                  <input type="tel" className="input" placeholder="+91 98765 43210"
                    value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Your number will be visible to scanners in WhatsApp chat.</p>
                </>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Emergency Contact */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Emergency Contact</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">If someone presses Emergency, their phone will call this number.</p>

        {!editing ? (
          <div className="space-y-4">
            <Field label="Contact Name" value={profile?.emergency_name} />
            <Field label="Contact Phone" value={profile?.emergency_phone} />
            <Field label="Relationship" value={profile?.emergency_rel} />
          </div>
        ) : (
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
        )}
      </div>

      {/* Save button — only in edit mode */}
      {editing && (
        <>
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
          )}
          <button type="submit" form="profile-form" disabled={saving} className="btn-primary w-full">
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </>
      )}

      {/* Push Notifications — always visible */}
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

      {/* Two-Factor Authentication */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Two-Factor Authentication</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {mfaEnrolled
                ? 'Email OTP is active. You\'ll receive a code every time you sign in.'
                : 'Add an extra layer of security — receive a one-time code by email on every sign-in.'}
            </p>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            mfaEnrolled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {mfaEnrolled
              ? <><ShieldCheck className="w-3.5 h-3.5" /> Enabled</>
              : <><ShieldOff className="w-3.5 h-3.5" /> Disabled</>}
          </div>
        </div>

        {mfaError && <p className="text-xs text-red-500 mt-2">{mfaError}</p>}
        {mfaSuccess && <p className="text-xs text-green-600 mt-2">{mfaSuccess}</p>}

        {!mfaEnrolled && mfaStage === 'idle' && (
          <button
            onClick={handleEnrol2FA}
            disabled={mfaLoading}
            className="btn-secondary mt-3 text-sm flex items-center gap-2"
          >
            {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Enable 2FA
          </button>
        )}

        {mfaStage === 'verify' && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-500">A 6-digit code has been sent to your email. Enter it below to complete setup.</p>
            <input
              type="text"
              inputMode="numeric"
              className="input text-center text-xl tracking-widest font-mono"
              placeholder="000000"
              value={mfaOtp}
              onChange={(e) => setMfaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleVerify2FA}
                disabled={mfaLoading || mfaOtp.length !== 6}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Verify & Enable
              </button>
              <button
                onClick={() => { setMfaStage('idle'); setMfaOtp(''); setMfaError('') }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {mfaEnrolled && mfaStage !== 'verify' && (
          <button
            onClick={handleUnenrol2FA}
            disabled={mfaLoading}
            className="mt-3 text-xs text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
          >
            {mfaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
            Disable 2FA
          </button>
        )}
      </div>
    </div>
  )
}
