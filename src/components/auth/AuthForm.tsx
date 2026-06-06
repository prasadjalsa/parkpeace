import { useState } from 'react'
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { HelpSection } from './HelpSection'

type Tab = 'login' | 'register' | 'forgot'
type Stage = 'credentials' | 'otp'

function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  minLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minLength?: number
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className="input pr-10"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export function AuthForm() {
  const [tab, setTab] = useState<Tab>('login')
  const [stage, setStage] = useState<Stage>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const navigate = useNavigate()

  function switchTab(t: Tab) {
    setTab(t)
    setMessage(null)
    setPassword('')
    setConfirm('')
    setStage('credentials')
    setOtp('')
  }

  async function sendOtp(accessToken: string): Promise<boolean> {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      }
    )
    const data = await res.json()
    return data.otpRequired === true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (tab === 'register' && password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    setLoading(true)

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
        return
      }

      // OTP disabled — navigate directly
      sessionStorage.removeItem('otp_pending')
      const next = new URLSearchParams(window.location.search).get('next')
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        navigate(next, { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } else if (tab === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        localStorage.setItem('parkpeace_new_user', 'true')
        setMessage({ type: 'success', text: 'Account created! You can now log in.' })
        setTab('login')
        setConfirm('')
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Password reset email sent. Check your inbox.' })
      }
    }
    setLoading(false)
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!otp.trim()) return
    setLoading(true)
    setMessage(null)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code: otp.trim() }),
      }
    )
    const data = await res.json()

    if (!data.verified) {
      setMessage({ type: 'error', text: data.error ?? 'Invalid code. Please try again.' })
      setLoading(false)
      return
    }

    // OTP verified — clear pending flag and force session refresh
    sessionStorage.removeItem('otp_pending')
    // Re-trigger auth state by refreshing the session
    await supabase.auth.refreshSession()
    const next = new URLSearchParams(window.location.search).get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      navigate(next, { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
    setLoading(false)
  }

  async function resendOtp() {
    setResending(true)
    setMessage(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await sendOtp(session.access_token)
      setMessage({ type: 'success', text: 'New code sent. Check your email.' })
    }
    setResending(false)
  }

  // ── OTP verification screen ───────────────────────────────────────────────

  if (stage === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg overflow-hidden">
              <img src="/favicon.png" alt="ParkPeace" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">ParkPeace</h1>
            <p className="text-gray-500 mt-1 text-sm">Smart QR alerts for your parked car</p>
          </div>

          <div className="card">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-50 rounded-full mb-3">
                <ShieldCheck className="w-6 h-6 text-primary-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Check your email</h2>
              <p className="text-xs text-gray-500 mt-1">
                We sent a 6-digit verification code to <strong>{email}</strong>
              </p>
            </div>

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="label">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>

              {message && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  message.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-primary-50 text-primary-700 border border-primary-200'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : 'Verify & Sign In'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStage('credentials'); setOtp(''); setMessage(null) }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resending}
                  className="text-primary-600 hover:text-primary-800 transition-colors"
                >
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── Credentials screen ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg overflow-hidden">
            <img src="/favicon.png" alt="ParkPeace" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ParkPeace</h1>
          <p className="text-gray-500 mt-1 text-sm">Smart QR alerts for your parked car</p>
        </div>

        <div className="card">
          {tab !== 'forgot' && (
            <div className="flex rounded-lg border border-gray-200 p-1 mb-6 bg-gray-50">
              {(['login', 'register'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                    tab === t
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>
          )}

          {tab === 'forgot' && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back to Sign In
              </button>
              <h2 className="text-base font-semibold text-gray-900 mt-2">Reset your password</h2>
              <p className="text-xs text-gray-500 mt-0.5">Enter your email and we'll send you a reset link.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {tab !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Password</label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchTab('forgot')}
                      className="text-xs text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <PasswordInput value={password} onChange={setPassword} minLength={6} />
              </div>
            )}

            {tab === 'register' && (
              <div>
                <label className="label">Confirm Password</label>
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="••••••••"
                />
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                )}
                {confirm && password === confirm && (
                  <p className="text-xs text-primary-600 mt-1">Passwords match ✓</p>
                )}
              </div>
            )}

            {message && (
              <div className={`rounded-lg px-4 py-3 text-sm ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-primary-50 text-primary-700 border border-primary-200'
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (tab === 'register' && (password !== confirm || !confirm))}
              className="btn-primary w-full"
            >
              {loading
                ? 'Please wait…'
                : tab === 'login'
                  ? 'Sign In'
                  : tab === 'register'
                    ? 'Create Account'
                    : 'Send Reset Link'}
            </button>
          </form>
        </div>
        <HelpSection />
      </div>
    </div>
  )
}
