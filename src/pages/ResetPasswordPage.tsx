import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
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
        minLength={6}
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

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const navigate = useNavigate()

  // Supabase fires PASSWORD_RECOVERY once the user lands here from the email link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password updated! Redirecting to dashboard…' })
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg overflow-hidden">
            <img src="/favicon.png" alt="ParkPeace" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ParkPeace</h1>
          <p className="text-gray-500 mt-1 text-sm">Choose a new password</p>
        </div>

        <div className="card">
          {!ready ? (
            <div className="text-center py-6 text-sm text-gray-500">
              <p>Verifying reset link…</p>
              <p className="text-xs text-gray-400 mt-2">
                If nothing happens, the link may have expired.{' '}
                <button
                  onClick={() => navigate('/')}
                  className="text-primary-600 hover:underline"
                >
                  Request a new one
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <PasswordInput value={password} onChange={setPassword} />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <PasswordInput value={confirm} onChange={setConfirm} />
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                )}
                {confirm && password === confirm && (
                  <p className="text-xs text-primary-600 mt-1">Passwords match ✓</p>
                )}
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
                disabled={loading || !password || password !== confirm}
                className="btn-primary w-full"
              >
                {loading ? 'Updating…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
