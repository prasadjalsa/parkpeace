import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ChatWindow } from '../components/chat/ChatWindow'

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [expired, setExpired] = useState(false)

  if (loading) return null
  if (!user) return <Navigate to={`/?next=/chat/${sessionId}`} replace />
  if (!sessionId) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden">
                <img src="/favicon.png" alt="ParkPeace" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-gray-900">ParkPeace Chat</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {expired ? (
          <div className="card text-center py-10">
            <p className="font-semibold text-gray-700">This chat has expired</p>
            <p className="text-sm text-gray-400 mt-1">
              Chats are automatically deleted after 24 hours.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary mt-4 text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <ChatWindow
            sessionId={sessionId}
            senderRole="owner"
            onExpired={() => setExpired(true)}
          />
        )}
      </main>
    </div>
  )
}
