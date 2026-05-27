import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, Plus, Trash2, QrCode, X, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ScanHistory } from './ScanHistory'

interface QRCode {
  id: string
  name: string
  created_at: string
}

interface Props {
  userId: string
}

export function QRCodeManager({ userId }: Props) {
  const [codes, setCodes] = useState<QRCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [historyFor, setHistoryFor] = useState<QRCode | null>(null)
  const modalInputRef = useRef<HTMLInputElement>(null)

  async function fetchCodes() {
    const { data } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setCodes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchCodes() }, [userId])

  useEffect(() => {
    if (showModal) setTimeout(() => modalInputRef.current?.focus(), 50)
  }, [showModal])

  async function createCode() {
    if (!newName.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('qr_codes')
      .insert({ user_id: userId, name: newName.trim() })
      .select()
      .single()
    setCreating(false)
    if (!error && data) {
      setCodes((prev) => [data, ...prev])
      setNewName('')
      setShowModal(false)
    }
  }

  async function deleteCode(id: string) {
    if (!confirm('Delete this vehicle QR? Anyone with a printed copy will get a "not found" page.')) return
    setDeleting(id)
    await supabase.from('qr_codes').delete().eq('id', id)
    setCodes((prev) => prev.filter((c) => c.id !== id))
    setDeleting(null)
  }

  function downloadQR(id: string, name: string) {
    const qrCanvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement
    if (!qrCanvas) return

    // Card dimensions
    const W = 400
    const headerH = 72
    const qrSize = 260
    const qrPad = 30        // space above and below QR inside card
    const footerH = 110
    const H = headerH + qrPad + qrSize + qrPad + footerH

    const card = document.createElement('canvas')
    card.width = W
    card.height = H
    const ctx = card.getContext('2d')!

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // Green header
    ctx.fillStyle = '#16a34a'
    ctx.fillRect(0, 0, W, headerH)

    // Header label — "ParkPeace"
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ParkPeace', W / 2, headerH / 2)

    // QR code — drawn at qrSize × qrSize (upscaled from the 160px canvas for print quality)
    const qrX = (W - qrSize) / 2
    const qrY = headerH + qrPad
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

    // Light divider line below QR
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(32, qrY + qrSize + qrPad - 2)
    ctx.lineTo(W - 32, qrY + qrSize + qrPad - 2)
    ctx.stroke()

    // Vehicle name
    const footerTop = headerH + qrPad + qrSize + qrPad + 14
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 17px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(name, W / 2, footerTop)

    // Instruction line 1
    ctx.fillStyle = '#4b5563'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('Scan to contact the car owner', W / 2, footerTop + 26)

    // Instruction line 2
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText('if my car is causing any issues', W / 2, footerTop + 46)

    // Bottom branding
    ctx.fillStyle = '#d1fae5'
    ctx.fillRect(0, H - 26, W, 26)
    ctx.fillStyle = '#16a34a'
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillText('Powered by ParkPeace', W / 2, H - 10)

    const link = document.createElement('a')
    link.download = `${name.replace(/\s+/g, '-')}-parkpeace-qr.png`
    link.href = card.toDataURL('image/png')
    link.click()
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{codes.length} vehicle{codes.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowModal(true)} className="btn-primary py-2 text-xs">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {codes.length === 0 ? (
        <div className="card text-center py-12">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No vehicles yet</p>
          <p className="text-gray-400 text-xs mt-1">Add one for each car or vehicle you park</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {codes.map((code) => {
            const url = `${window.location.origin}/scan/${code.id}`
            return (
              <div key={code.id} className="card flex flex-col items-center gap-4">
                <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                  <QRCodeCanvas
                    id={`qr-${code.id}`}
                    value={url}
                    size={160}
                    level="M"
                    includeMargin
                  />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">{code.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Added {new Date(code.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => downloadQR(code.id, code.name)}
                    className="btn-secondary flex-1 py-2 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  <button
                    onClick={() => setHistoryFor(code)}
                    className="btn-secondary py-2 text-xs px-3"
                    title="View scan history"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteCode(code.id)}
                    disabled={deleting === code.id}
                    className="p-2.5 rounded-lg border border-gray-200 text-red-400 hover:bg-red-50 hover:border-red-200 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Vehicle modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Add Vehicle</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Vehicle Name</label>
                <input
                  ref={modalInputRef}
                  type="text"
                  className="input"
                  placeholder="e.g. My Swift, Red Honda, Work Car"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createCode()}
                  maxLength={60}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={createCode}
                  disabled={creating || !newName.trim()}
                  className="btn-primary flex-1"
                >
                  {creating ? 'Creating…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-vehicle scan history modal */}
      {historyFor && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900">Scan History</h3>
                <p className="text-xs text-gray-400 mt-0.5">{historyFor.name}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <ScanHistory qrCodeId={historyFor.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
