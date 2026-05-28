import { useEffect, useState } from 'react'
import { Mail, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Message {
  id: string
  user_email: string
  message: string
  created_at: string
}

export function DeveloperInbox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('contact_developer')
        .select('id, user_email, message, created_at')
        .order('created_at', { ascending: false })
      if (data) setMessages(data)
      setLoading(false)
    }
    load()
  }, [])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(selected.size === messages.length ? new Set() : new Set(messages.map((m) => m.id)))
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    setDeleting(true)
    const ids = Array.from(selected)
    await supabase.from('contact_developer').delete().in('id', ids)
    setMessages((prev) => prev.filter((m) => !selected.has(m.id)))
    setSelected(new Set())
    setDeleting(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No messages yet.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected.size === messages.length}
            onChange={toggleAll}
            className="rounded"
          />
          {selected.size === 0 ? 'Select all' : `${selected.size} selected`}
        </label>
        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 transition-colors"
          >
            {deleting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
            Delete {selected.size === messages.length ? 'all' : `(${selected.size})`}
          </button>
        )}
      </div>

      {/* Messages */}
      {messages.map((msg) => (
        <div
          key={msg.id}
          onClick={() => toggleSelect(msg.id)}
          className={`card p-4 space-y-2 cursor-pointer transition-colors ${
            selected.has(msg.id) ? 'border-primary-400 bg-primary-50' : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected.has(msg.id)}
              onChange={() => toggleSelect(msg.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 rounded shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary-700 truncate">{msg.user_email}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{msg.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
