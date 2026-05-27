import { useState } from 'react'
import { MessageSquare, CheckCircle, Loader2, Bell, BellOff } from 'lucide-react'
import { ChatWindow } from '../chat/ChatWindow'
import { requestFCMToken } from '../../lib/firebase'
import { supabase } from '../../lib/supabase'

interface Props {
  qrCodeId: string
}

type State = 'form' | 'loading' | 'success' | 'error'

function buildWhatsAppUrl(phone: string, carName: string, scannerName: string, scannerPhone: string, note: string) {
  const digits = phone.replace(/\D/g, '')
  const lines = [
    `Hi! I scanned your ParkPeace QR code for *${carName}*.`,
    '',
    `From: ${scannerName}`,
    scannerPhone ? `My number: ${scannerPhone}` : '',
    '',
    note,
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
  const text = encodeURIComponent(lines.join('\n'))
  return `https://wa.me/${digits}?text=${text}`
}

export function ContactSection({ qrCodeId }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<State>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [chatSessionId, setChatSessionId] = useState<string | null>(() => {
    return sessionStorage.getItem(`chat_session_${qrCodeId}`)
  })
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [notifyError, setNotifyError] = useState('')

  async function enableNotifications(sessionId: string) {
    setNotifyLoading(true)
    setNotifyError('')
    const result = await requestFCMToken()
    if ('error' in result) {
      setNotifyLoading(false)
      if (
        result.error.toLowerCase().includes('permission') ||
        result.error.toLowerCase().includes('blocked') ||
        result.error.toLowerCase().includes('denied')
      ) {
        setNotifyError('Notification permission denied. Enable it in your browser settings.')
      } else if (result.error.toLowerCase().includes('safari') || result.error.toLowerCase().includes('not available')) {
        setNotifyError('On iPhone, add this page to your Home Screen first, then try again.')
      } else {
        setNotifyError('Could not enable notifications. On iPhone, add to Home Screen first.')
      }
      return
    }
    await supabase
      .from('chat_sessions')
      .update({ scanner_fcm_token: result.token })
      .eq('id', sessionId)
    setNotifyEnabled(true)
    setNotifyLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !note.trim()) return
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) { setState('error'); setErrorMsg('Your number must be exactly 10 digits.'); return }
    setState('loading')

    // Open a blank tab now — browsers only allow window.open from a direct click event.
    // We'll navigate it to WhatsApp once we get the number back from the server.
    const waTab = window.open('', '_blank')

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
            scannerPhone: phone.trim() || null,
            note: note.trim(),
            action: 'contact',
          }),
        }
      )

      if (!res.ok) throw new Error('Failed to send notification')
      const data = await res.json()

      // Navigate the pre-opened tab to WhatsApp if the owner has a WhatsApp number
      if (waTab && data.whatsappNumber) {
        waTab.location.href = buildWhatsAppUrl(
          data.whatsappNumber,
          data.carName ?? '',
          name.trim(),
          phone.trim(),
          note.trim(),
        )
      } else if (waTab) {
        waTab.close()
      }

      if (data.chatSessionId) {
        setChatSessionId(data.chatSessionId)
        sessionStorage.setItem(`chat_session_${qrCodeId}`, data.chatSessionId)
      }

      setState('success')
    } catch {
      waTab?.close()
      setErrorMsg('Could not reach the owner. Please try again.')
      setState('error')
    }
  }

  if (state === 'success' || chatSessionId) {
    return (
      <div>
        <div className="text-center py-6">
          <CheckCircle className="w-14 h-14 text-primary-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-900 text-lg">Owner Notified</p>
          <p className="text-gray-500 text-sm mt-1">
            The car owner has received your message via push notification.
          </p>
          <p className="text-gray-400 text-xs mt-1">WhatsApp has been opened if the owner has it set up.</p>
        </div>
        {chatSessionId && !notifyEnabled && (
          <div className="mb-3 flex flex-col items-center gap-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 text-center max-w-xs">
              <strong>iPhone users:</strong> Add this page to your Home Screen first, then tap the button below to receive reply notifications.
            </div>
            <button
              onClick={() => enableNotifications(chatSessionId)}
              disabled={notifyLoading}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {notifyLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Bell className="w-4 h-4" />}
              Get notified when owner replies
            </button>
            {notifyError && (
              <p className="text-xs text-red-500 text-center px-2">{notifyError}</p>
            )}
          </div>
        )}
        {chatSessionId && notifyEnabled && (
          <div className="mb-3 flex justify-center">
            <span className="flex items-center gap-1.5 text-xs text-primary-600">
              <BellOff className="w-3.5 h-3.5" /> You'll be notified of new replies
            </span>
          </div>
        )}
        {chatSessionId && (
          <div className="mt-2">
            <ChatWindow
              sessionId={chatSessionId}
              senderRole="scanner"
              scannerName={name || undefined}
            />
          </div>
        )}
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
          maxLength={100}
        />
      </div>
      <div>
        <label className="label">Your Number <span className="text-red-500">*</span></label>
        <input
          type="tel"
          className="input"
          placeholder="10-digit number e.g. 9876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
        disabled={state === 'loading' || !name.trim() || !phone.trim() || !note.trim()}
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
