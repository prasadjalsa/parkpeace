import { useState } from 'react'
import { MessageSquare, CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  qrCodeId: string
}

type State = 'form' | 'loading' | 'success' | 'error'

export function ContactSection({ qrCodeId }: Props) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<State>('form')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !note.trim()) return
    setState('loading')

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-owner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            qrCodeId,
            scannerName: name.trim(),
            note: note.trim(),
            action: 'contact',
          }),
        }
      )

      if (!res.ok) throw new Error('Failed to send notification')
      setState('success')
    } catch {
      setErrorMsg('Could not reach the owner. Please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-6">
        <CheckCircle className="w-14 h-14 text-primary-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-900 text-lg">Owner Notified</p>
        <p className="text-gray-500 text-sm mt-1">The car owner has received your message.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Your Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          className="input"
          placeholder="e.g. Anil Kumar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label">Message / Reason <span className="text-red-500">*</span></label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="e.g. Your car is blocking my driveway. Please move it when possible."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
        />
      </div>

      {state === 'error' && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'loading' || !name.trim() || !note.trim()}
        className="btn-primary w-full"
      >
        {state === 'loading' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
        ) : (
          <><MessageSquare className="w-4 h-4" /> Notify Owner</>
        )}
      </button>
    </form>
  )
}
