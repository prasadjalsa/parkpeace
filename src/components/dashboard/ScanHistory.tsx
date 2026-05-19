import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Clock, MessageSquare, Phone, AlertTriangle } from 'lucide-react'

interface ScanEvent {
  id: string
  action: string
  scanner_name: string | null
  scanner_note: string | null
  scanner_phone: string | null
  scanned_at: string
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

export function ScanHistory({ userId: _userId, qrCodeId }: Props) {
  const [events, setEvents] = useState<ScanEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let query = supabase
      .from('scan_events')
      .select('id, action, scanner_name, scanner_note, scanner_phone, scanned_at, qr_codes(name)')
      .order('scanned_at', { ascending: false })
      .limit(50)

    if (qrCodeId) {
      query = query.eq('qr_code_id', qrCodeId)
    }

    query.then(({ data }) => {
      setEvents((data as unknown as ScanEvent[]) ?? [])
      setLoading(false)
    })
  }, [qrCodeId])

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
  }

  if (events.length === 0) {
    return (
      <div className="card text-center py-12">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm font-medium">No scans yet</p>
        <p className="text-gray-400 text-xs mt-1">Events will appear here once someone scans your QR code</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
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
      })}
    </div>
  )
}
