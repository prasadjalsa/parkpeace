import { useState } from 'react'
import { MessageCircle, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type State = 'idle' | 'loading' | 'success' | 'error'

export function ContactDeveloperForm() {
  const [message, setMessage] = useState('')
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setState('loading')
    setErrorMsg('')

    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-developer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ message: message.trim() }),
        }
      )
      if (!res.ok) throw new Error('Failed to send')
      setState('success')
      setMessage('')
    } catch {
      setErrorMsg('Could not send your message. Please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-12 h-12 text-primary-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-900">Message Sent</p>
        <p className="text-sm text-gray-500 mt-1">The developer has been notified. Thank you for your feedback.</p>
        <button
          onClick={() => setState('idle')}
          className="btn-secondary mt-4 text-sm"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <p className="text-gray-500">
        Send feedback, report a bug, or ask a question. Your email will be shared with the developer so they can follow up.
      </p>
      <div>
        <label className="label">Message <span className="text-red-500">*</span></label>
        <textarea
          className="input resize-none"
          rows={5}
          placeholder="Describe your issue or feedback…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={2000}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/2000</p>
      </div>

      {state === 'error' && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'loading' || !message.trim()}
        className="btn-primary w-full"
      >
        {state === 'loading'
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
          : <><MessageCircle className="w-4 h-4" /> Send Message</>
        }
      </button>
    </form>
  )
}
