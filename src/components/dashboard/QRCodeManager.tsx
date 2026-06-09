import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, Plus, Trash2, QrCode, X, Clock, Car, Home } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { auditLog } from '../../lib/audit'
import { ScanHistory } from './ScanHistory'

interface QRCode {
  id: string
  name: string
  created_at: string
  template: 'car' | 'home'
  header_color: string
}

interface Props {
  userId: string
}

const PRESET_COLORS = ['#16a34a', '#4F46E5', '#dc2626', '#d97706', '#0891b2', '#7c3aed']

// Returns white or black text based on background luminance
function getTextColor(hex: string): '#ffffff' | '#111827' {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#111827' : '#ffffff'
}

export function QRCodeManager({ userId }: Props) {
  const [codes, setCodes] = useState<QRCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTemplate, setNewTemplate] = useState<'car' | 'home'>('car')
  const [newColor, setNewColor] = useState('#16a34a')
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
      .insert({ user_id: userId, name: newName.trim(), template: newTemplate, header_color: newColor })
      .select()
      .single()
    setCreating(false)
    if (!error && data) {
      auditLog('qr_created', { name: data.name, template: data.template })
      setCodes((prev) => [data, ...prev])
      setNewName('')
      setNewTemplate('car')
      setNewColor('#16a34a')
      setShowModal(false)
    } else if (error?.code === '23505') {
      alert(`A QR code named "${newName.trim()}" already exists. Please choose a different name.`)
    }
  }

  async function deleteCode(id: string) {
    const code = codes.find(c => c.id === id)
    if (!confirm('Delete this QR code? Anyone with a printed copy will get a "not found" page.')) return
    setDeleting(id)
    await supabase.from('qr_codes').delete().eq('id', id)
    auditLog('qr_deleted', { name: code?.name, template: code?.template })
    setCodes((prev) => prev.filter((c) => c.id !== id))
    setDeleting(null)
  }

  function downloadQR(id: string, name: string, template: 'car' | 'home' = 'car', headerColor = '#16a34a', textColor = '#ffffff') {
    const qrCanvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement
    if (!qrCanvas) return

    const isHome = template === 'home'

    // Card dimensions
    const W = 400
    const headerH = 72
    const qrSize = 260
    const qrPad = 30
    const footerH = 110
    const H = headerH + qrPad + qrSize + qrPad + footerH

    const card = document.createElement('canvas')
    card.width = W
    card.height = H
    const ctx = card.getContext('2d')!

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // Header
    ctx.fillStyle = headerColor
    ctx.fillRect(0, 0, W, headerH)

    // Header label
    ctx.fillStyle = textColor
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ParkPeace', W / 2, headerH / 2)

    // QR code
    const qrX = (W - qrSize) / 2
    const qrY = headerH + qrPad
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

    // Divider
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(32, qrY + qrSize + qrPad - 2)
    ctx.lineTo(W - 32, qrY + qrSize + qrPad - 2)
    ctx.stroke()

    // Name
    const footerTop = headerH + qrPad + qrSize + qrPad + 14
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 17px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(name, W / 2, footerTop)

    // Instruction line 1
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillText(
      isHome ? 'Scan to notify the resident' : 'Scan to contact the car owner',
      W / 2, footerTop + 26
    )

    // Instruction line 2
    ctx.fillStyle = '#4b5563'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.fillText(
      isHome ? 'if you need assistance or have arrived' : 'if my car is causing any issues',
      W / 2, footerTop + 48
    )

    // Bottom branding — light tint of header color
    ctx.fillStyle = headerColor + '22'  // 13% opacity tint
    ctx.fillRect(0, H - 26, W, 26)
    ctx.fillStyle = headerColor
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

  function renderCard(code: QRCode, url: string) {
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
            onClick={() => downloadQR(code.id, code.name, code.template, code.header_color, getTextColor(code.header_color))}
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
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{codes.length} QR code{codes.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowModal(true)} className="btn-primary py-2 text-xs">
          <Plus className="w-4 h-4" /> Add QR Code
        </button>
      </div>

      {codes.length === 0 ? (
        <div className="card text-center py-12">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No QR codes yet</p>
          <p className="text-gray-400 text-xs mt-1">Add one for each car, vehicle, home or flat</p>
        </div>
      ) : (
        <>
          {/* Car / Vehicle group */}
          {codes.filter(c => c.template !== 'home').length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-700">Cars &amp; Vehicles</h3>
                <span className="text-xs text-gray-400">({codes.filter(c => c.template !== 'home').length})</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {codes.filter(c => c.template !== 'home').map((code) => {
                  const url = `${window.location.origin}/scan/${code.id}`
                  return renderCard(code, url)
                })}
              </div>
            </div>
          )}

          {/* Home / Flat group */}
          {codes.filter(c => c.template === 'home').length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-gray-700">Homes &amp; Flats</h3>
                <span className="text-xs text-gray-400">({codes.filter(c => c.template === 'home').length})</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {codes.filter(c => c.template === 'home').map((code) => {
                  const url = `${window.location.origin}/scan/${code.id}`
                  return renderCard(code, url)
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add QR Code modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Add QR Code</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">What is this QR for?</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setNewTemplate('car')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      newTemplate === 'car'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Car className="w-6 h-6" />
                    <span className="text-xs font-semibold">Car / Vehicle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTemplate('home')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      newTemplate === 'home'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Home className="w-6 h-6" />
                    <span className="text-xs font-semibold">Home / Flat</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="label">{newTemplate === 'home' ? 'Home or Unit Name' : 'Car or Vehicle Name'}</label>
                <input
                  ref={modalInputRef}
                  type="text"
                  className="input"
                  placeholder={newTemplate === 'home' ? 'e.g. Flat 4B, Tower 2, Main Entrance' : 'e.g. My Swift, Red Honda, Work Car'}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createCode()}
                  maxLength={60}
                />
              </div>
              <div>
                <label className="label">Header Colour</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        newColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border border-gray-200"
                    title="Custom colour"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  Header text will be
                  <span
                    className="font-semibold px-1.5 py-0.5 rounded text-xs"
                    style={{ backgroundColor: newColor, color: getTextColor(newColor) }}
                  >
                    {getTextColor(newColor) === '#ffffff' ? 'White' : 'Black'}
                  </span>
                  (auto-selected for readability)
                </p>
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

      {/* Per-QR scan history modal */}
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
