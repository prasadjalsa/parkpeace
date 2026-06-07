import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ContactSection } from '../components/scan/ContactSection'
import { EmergencySection } from '../components/scan/EmergencySection'

interface QRInfo {
  id: string
  name: string
  template: 'car' | 'home'
}

export function ScanPage() {
  const { qrId } = useParams<{ qrId: string }>()
  const [searchParams] = useSearchParams()
  const sessionFromUrl = searchParams.get('session')  const [qr, setQr] = useState<QRInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  useEffect(() => {
    if (!qrId) { setNotFound(true); setLoading(false); return }
    supabase
      .from('qr_codes')
      .select('id, name, template')
      .eq('id', qrId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setQr(data)
        setLoading(false)
      })
  }, [qrId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-xs">
          <img src="/favicon.png" alt="ParkPeace" className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-gray-700">QR Code Not Found</p>
          <p className="text-gray-400 text-sm mt-1">
            This QR code may have been removed. Please leave a note on the car.
          </p>
        </div>
      </div>
    )
  }

  const isHome = qr?.template === 'home'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 pt-10 pb-8">
        <div className="max-w-md mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-3 overflow-hidden">
            <img src="/favicon.png" alt="ParkPeace" className="w-10 h-10 object-cover" />
          </div>
          <p className="text-primary-100 text-sm mb-1">You scanned a ParkPeace QR code</p>
          <h1 className="text-2xl font-bold">{qr!.name}</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-2 pb-12 space-y-4">
        {/* Contact card */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-50 rounded-lg overflow-hidden flex items-center justify-center">
              <img src="/favicon.png" alt="ParkPeace" className="w-6 h-6 object-cover" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">
                {isHome ? 'Notify Resident' : 'Contact Owner'}
              </h2>
              <p className="text-xs text-gray-400">
                {isHome ? 'Send a message to the resident' : 'Send a message to the car owner'}
              </p>
            </div>
          </div>
          <ContactSection qrCodeId={qr!.id} template={qr!.template} sessionFromUrl={sessionFromUrl} />
        </div>

        {/* Emergency — collapsible */}
        <div className="border border-red-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setEmergencyOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-5 py-4 bg-red-50 hover:bg-red-100 transition-colors text-left"
          >
            <div>
              <span className="font-semibold text-red-700 text-sm">Emergency</span>
              <p className="text-xs text-red-500 mt-0.5">
                {isHome ? 'Only for genuine emergencies (fire, break-in, medical)' : 'Only for genuine emergencies'}
              </p>
            </div>
            {emergencyOpen
              ? <ChevronUp className="w-4 h-4 text-red-500 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-red-500 shrink-0" />
            }
          </button>
          {emergencyOpen && (
            <div className="p-5 bg-white">
              <EmergencySection qrCodeId={qr!.id} template={qr!.template} />
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-300">Powered by ParkPeace</p>

        {/* CTA */}
        <div className="rounded-xl bg-primary-50 border border-primary-100 px-5 py-4 text-center">
          <p className="text-sm font-semibold text-primary-800">Liked the idea?</p>
          <p className="text-xs text-primary-600 mt-1 mb-3">
            {isHome
              ? 'Get instant alerts when guests arrive at your home.'
              : 'Get instant alerts when someone needs to reach your car.'}
          </p>
          <a
            href="/"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            Be a user today — it's free
          </a>
        </div>
      </div>
    </div>
  )
}
