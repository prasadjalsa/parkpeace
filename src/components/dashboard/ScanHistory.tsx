import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Clock, MessageSquare, Phone, AlertTriangle, Trash2, X } from 'lucide-react'

interface ScanEvent {
  id: string
  action: string
  scanner_name: string | null
  scanner_note: string | null
  scanner_phone: string | null
  scanned_at: string
  chat_session_id: string | null
  qr_codes: { name: string } | null
}

interface Props {
  userId: string
  qrCodeId?: string
}

const actionMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  contact: {
    label: 'Contact',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: 'bg-blue-50 text-blue-700',
  },
  emergency: {
    label: 'Emergency',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: 'bg-red-50 text-red-700',
  },
  contact_call: {
    label: 'Call',
    icon: <Phone className="w-3.5 h-3.5" />,
    color: 'bg-amber-50 text-amber-700',
  },
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function ScanHistory({ userId: _userId, qrCodeId }: Props) {
  const [events, setEvents] = useState<ScanEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showClear, setShowClear] = useState(false)
  const [fromDate, setFromDate] = useState(daysAgo(30))
  const [toDate, setToDate] = useState(today())
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function fetchEvents() {
    let query = supabase
      .from('scan_events')
      .select('id, action, scanner_name, scanner_note, scanner_phone, scanned_at, chat_session_id, qr_codes(name)')
      .order('scanned_at', { ascending: false })
      .limit(50)

    if (qrCodeId) query = query.eq('qr_code_id', qrCodeId)

    const { data } = await query
    setEvents((data as unknown as ScanEvent[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [qrCodeId])

  async function handleClear() {
    if (!fromDate || !toDate) return
    setClearing(true)
    setClearError(null)

    let query = supabase
      .from('scan_events')
      .delete()
      .gte('scanned_at', `${fromDate}T00:00:00`)
      .lte('scanned_at', `${toDate}T23:59:59`)

    if (qrCodeId) query = query.eq('qr_code_id', qrCodeId)

    const { error } = await query
    setClearing(false)

    if (error) {
      setClearError('Could not delete events. Please try again.')
      return
    }

    setShowClear(false)
    setLoading(true)
    fetchEvents()
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        {!showClear ? (
          <button
            onClick={() => { setShowClear(true); setClearError(null) }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear History
          </button>
        ) : (
          <button
            onClick={() => setShowClear(false)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}
      </div>

      {/* Date range clear panel */}
      {showClear && (
        <div className="card border border-red-100 bg-red-50 space-y-4">
          <div>
            <p className="text-sm font-semibold text-red-700 mb-1">Clear events in date range</p>
            <p className="text-xs text-red-500">This permanently deletes all scan events between the selected dates.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-red-600">From</label>
              <input
                type="date"
                className="input text-sm"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-red-600">To</label>
              <input
                type="date"
                className="input text-sm"
                value={toDate}
                min={fromDate}
                max={today()}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          {clearError && (
            <p className="text-xs text-red-600">{clearError}</p>
          )}
          <button
            onClick={handleClear}
            disabled={clearing || !fromDate || !toDate}
            className="btn-danger w-full text-sm py-2.5"
          >
            {clearing ? (
              'Deleting…'
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete Events: {fromDate} → {toDate}</>
            )}
          </button>
        </div>
      )}

      {/* Event list */}
      {events.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No scans yet</p>
          <p className="text-gray-400 text-xs mt-1">Events will appear here once someone scans your QR code</p>
        </div>
      ) : (
        events.map((event) => {
          const meta = actionMeta[event.action] ?? {
            label: event.action,
            icon: <MessageSquare className="w-3.5 h-3.5" />,
            color: 'bg-gray-50 text-gray-700',
          }
          return (
            <div key={event.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                    {!qrCodeId && (
                      <span className="text-xs font-semibold text-gray-700">
                        {event.qr_codes?.name ?? 'Unknown QR'}
                      </span>
                    )}
                  </div>
                  {event.scanner_name && (
                    <p className="text-sm text-gray-700 mt-1.5 font-medium">{event.scanner_name}</p>
                  )}
                  {event.scanner_phone && (
                    <a
                      href={`tel:${event.scanner_phone}`}
                      className="text-xs text-primary-600 hover:underline mt-0.5 block"
                    >
                      {event.scanner_phone}
                    </a>
                  )}
                  {event.scanner_note && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{event.scanner_note}</p>
                  )}
                  {event.chat_session_id && (
                    <button
                      onClick={() => navigate(`/chat/${event.chat_session_id}`)}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Open Chat
                    </button>
                  )}
                </div>
                <time className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {new Date(event.scanned_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
