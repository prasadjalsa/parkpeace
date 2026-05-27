import { useState } from 'react'
import { AlertTriangle, Phone, Loader2 } from 'lucide-react'

interface Props {
  qrCodeId: string
}

type State = 'form' | 'loading' | 'calling' | 'error'

export function EmergencySection({ qrCodeId }: Props) {
  const [name, setName] = useState('')
  const [situation, setSituation] = useState('')
  const [state, setState] = useState<State>('form')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleEmergency(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !situation.trim()) return
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
            note: situation.trim(),
            action: 'emergency',
          }),
        }
      )

      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()

      setState('calling')

      // Open phone dialer on scanner's device to call emergency contact
      if (data.emergencyPhone) {
        window.location.href = `tel:${data.emergencyPhone}`
      }
    } catch {
      setErrorMsg('Could not connect. Please call emergency services directly.')
      setState('error')
    }
  }

  if (state === 'calling') {
    return (
      <div className="text-center py-6">
        <Phone className="w-14 h-14 text-red-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-900 text-lg">Connecting Call</p>
        <p className="text-gray-500 text-sm mt-1">
          Your phone should open the dialer for the emergency contact.
        </p>
        <p className="text-xs text-gray-400 mt-2">Owner has also been notified via push alert.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleEmergency} className="space-y-4">
      <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <p className="text-xs text-red-700">
          Only use this for genuine emergencies (accident, break-in, medical). The emergency
          contact will be called on your phone.
        </p>
      </div>

      <div>
        <label className="label">Your Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          className="input"
          placeholder="e.g. Sunita Reddy"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
      </div>
      <div>
        <label className="label">Describe the Emergency <span className="text-red-500">*</span></label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="e.g. The car has been hit. There is visible damage to the left side."
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          required
          maxLength={1000}
        />
      </div>

      {state === 'error' && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'loading' || !name.trim() || !situation.trim()}
        className="btn-danger w-full text-base py-4"
      >
        {state === 'loading' ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Connecting…</>
        ) : (
          <><Phone className="w-5 h-5" /> Call Emergency Contact</>
        )}
      </button>
    </form>
  )
}
