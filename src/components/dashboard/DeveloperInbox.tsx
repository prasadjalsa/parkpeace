import { useEffect, useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'
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
    <div className="space-y-3 max-w-2xl mx-auto px-4 py-4">
      {messages.map((msg) => (
        <div key={msg.id} className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary-700">{msg.user_email}</span>
            <span className="text-xs text-gray-400">
              {new Date(msg.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.message}</p>
        </div>
      ))}
    </div>
  )
}
