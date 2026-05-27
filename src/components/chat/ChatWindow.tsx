import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface ChatMessage {
  id: string
  session_id: string
  sender_role: 'scanner' | 'owner'
  body: string
  created_at: string
}

interface ChatSession {
  id: string
  expires_at: string
  scanner_name: string
}

interface Props {
  sessionId: string
  senderRole: 'scanner' | 'owner'
  scannerName?: string
  onExpired?: () => void
}

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function ChatWindow({ sessionId, senderRole, scannerName, onExpired }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [session, setSession] = useState<ChatSession | null>(null)
  const [expired, setExpired] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [countdown, setCountdown] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  // Track optimistic messages by local id so we can replace them on Realtime delivery
  const pendingRef = useRef<Map<string, { body: string; role: string; sentAt: number }>>(new Map())

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('id, session_id, sender_role, body, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, expires_at, scanner_name')
        .eq('id', sessionId)
        .single()

      if (error || !data || new Date(data.expires_at) <= new Date()) {
        setExpired(true)
        onExpired?.()
        return
      }

      setSession(data)
      setCountdown(formatCountdown(data.expires_at))
      await loadMessages()
      scrollToBottom()
    }

    init()
  }, [sessionId])

  // Countdown timer — updates every minute
  useEffect(() => {
    if (!session) return
    const timer = setInterval(() => {
      const remaining = formatCountdown(session.expires_at)
      setCountdown(remaining)
      if (remaining === 'expired') {
        setExpired(true)
        onExpired?.()
        clearInterval(timer)
      }
    }, 60_000)
    return () => clearInterval(timer)
  }, [session])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage
          setMessages((prev) => {
            // Replace matching optimistic message if one exists
            const now = Date.now()
            for (const [localId, p] of pendingRef.current.entries()) {
              if (
                p.body === incoming.body &&
                p.role === incoming.sender_role &&
                now - p.sentAt < 5000
              ) {
                pendingRef.current.delete(localId)
                return prev.map((m) => (m.id === localId ? incoming : m))
              }
            }
            // Deduplicate real messages
            if (prev.some((m) => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
          scrollToBottom()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  // Re-fetch on tab return (mobile suspension recovery)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') loadMessages()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sessionId])

  async function sendMessage() {
    const trimmed = draft.trim()
    if (!trimmed || sending || expired) return
    setSendError('')
    setSending(true)

    const localId = crypto.randomUUID()
    const optimistic: ChatMessage = {
      id: localId,
      session_id: sessionId,
      sender_role: senderRole,
      body: trimmed,
      created_at: new Date().toISOString(),
    }

    pendingRef.current.set(localId, { body: trimmed, role: senderRole, sentAt: Date.now() })
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    scrollToBottom()

    const { error } = await supabase
      .from('chat_messages')
      .insert({ session_id: sessionId, sender_role: senderRole, body: trimmed })

    if (error) {
      pendingRef.current.delete(localId)
      setMessages((prev) => prev.filter((m) => m.id !== localId))
      setDraft(trimmed)
      setSendError('Failed to send. Please try again.')
    } else {
      // Fire-and-forget: notify the other party via push
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-notify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ sessionId, senderRole, body: trimmed }),
        },
      ).catch(() => { /* non-critical */ })
    }

    setSending(false)
  }

  const displayName = scannerName ?? session?.scanner_name ?? 'Scanner'

  if (expired) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        <p className="font-medium text-gray-700">This chat has expired</p>
        <p className="text-xs mt-1">Chats are automatically deleted after 24 hours.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 overflow-hidden bg-white" style={{ height: '420px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary-600 text-white shrink-0">
        <div>
          <p className="text-sm font-semibold">
            {senderRole === 'owner' ? `Chat with ${displayName}` : 'Live Chat with Owner'}
          </p>
        </div>
        {countdown && (
          <span className="text-xs text-primary-100">Expires in {countdown}</span>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-6">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_role === senderRole
          const label = msg.sender_role === 'owner' ? 'Owner' : displayName
          return (
            <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-gray-400 mb-0.5 px-1">{label}</span>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                  isOwn
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}
              >
                {msg.body}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2">
        {sendError && (
          <p className="text-xs text-red-500 mb-1">{sendError}</p>
        )}
        {expired ? (
          <p className="text-xs text-gray-400 text-center py-1">Chat has expired</p>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              className="flex-1 input resize-none text-sm py-2"
              rows={1}
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              maxLength={2000}
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              className="btn-primary px-3 py-2 shrink-0"
              aria-label="Send"
            >
              {sending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
