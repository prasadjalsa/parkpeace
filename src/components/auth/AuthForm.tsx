import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { HelpSection } from './HelpSection'

type Tab = 'login' | 'register' | 'forgot'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  function switchTab(t: Tab) {
    setTab(t)
    setMessage(null)
    setConfirm('')
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
      if (error) setMessage({ type: 'error', text: error.message })
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
          {/* Tab switcher — hidden on forgot password view */}
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
