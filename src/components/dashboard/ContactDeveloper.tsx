import { useState } from 'react'
import { MessageCircle, X, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type State = 'idle' | 'loading' | 'success' | 'error'

export function ContactDeveloper() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function openModal() {
    setOpen(true)
    setState('idle')
    setMessage('')
    setErrorMsg('')
  }

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
    } catch {
      setErrorMsg('Could not send your message. Please try again.')
      setState('error')
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        aria-label="Contact Developer"
        title="Contact Developer"
      >
        <MessageCircle className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary-600" />
                <h2 className="font-semibold text-gray-900">Contact Developer</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {state === 'success' ? (
                <div className="text-center py-6">
                  <CheckCircle className="w-12 h-12 text-primary-500 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900">Message Sent</p>
                  <p className="text-sm text-gray-500 mt-1">The developer has been notified. Thank you for your feedback.</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="btn-primary mt-4 px-6"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-gray-500">
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
                      autoFocus
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
