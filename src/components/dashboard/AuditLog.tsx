import { useEffect, useState } from 'react'
import { Shield, Loader2, ChevronDown, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface AuditEntry {
  id: string
  user_email: string | null
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  sign_in:          { label: 'Sign In',         color: 'bg-blue-50 text-blue-700' },
  account_deleted:  { label: 'Account Deleted',  color: 'bg-red-50 text-red-700' },
  qr_created:       { label: 'QR Created',        color: 'bg-green-50 text-green-700' },
  qr_deleted:       { label: 'QR Deleted',        color: 'bg-orange-50 text-orange-700' },
  profile_updated:  { label: 'Profile Updated',   color: 'bg-primary-50 text-primary-700' },
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  async function loadEntries() {
    setLoading(true)
    let query = supabase
      .from('audit_log')
      .select('id, user_email, action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (filter !== 'all') query = query.eq('action', filter)
    const { data } = await query
    setEntries(data ?? [])
    setLoading(false)
  }

  async function clearAll() {
    if (!confirm('Delete all audit log entries? This cannot be undone.')) return
    setClearing(true)
    await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await loadEntries()
    setClearing(false)
  }

  async function clearOlderThan(days: number) {
    if (!confirm(`Delete audit entries older than ${days} days?`)) return
    setClearing(true)
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    await supabase.from('audit_log').delete().lt('created_at', cutoff)
    await loadEntries()
    setClearing(false)
  }

  useEffect(() => {
    loadEntries()
  }, [filter])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No audit entries yet.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
      {/* Filter + Clear toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {['all', ...Object.keys(ACTION_LABELS)].map((key) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setLoading(true) }}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === key
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {key === 'all' ? 'All' : ACTION_LABELS[key]?.label ?? key}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => clearOlderThan(30)}
            disabled={clearing || entries.length === 0}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear &gt;30 days
          </button>
          <button
            onClick={clearAll}
            disabled={clearing || entries.length === 0}
            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Clear all
          </button>
        </div>
      </div>

      {/* Entries */}
      {entries.map((entry) => {
        const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'bg-gray-50 text-gray-700' }
        const isExpanded = expanded === entry.id
        return (
          <div key={entry.id} className="card p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-gray-600 truncate">{entry.user_email ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
                {entry.details && (
                  <button onClick={() => setExpanded(isExpanded ? null : entry.id)}>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>
            {isExpanded && entry.details && (
              <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-600">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}
