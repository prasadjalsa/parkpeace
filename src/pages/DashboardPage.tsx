import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut, QrCode, Clock, UserCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { initForegroundMessaging } from '../lib/firebase'
import { QRCodeManager } from '../components/dashboard/QRCodeManager'
import { ScanHistory } from '../components/dashboard/ScanHistory'
import { HelpButton } from '../components/auth/HelpSection'
import { ContactDeveloper } from '../components/dashboard/ContactDeveloper'

type Tab = 'vehicles' | 'history'

const LAST_SEEN_KEY = 'scan_history_last_seen'

export function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const { profile } = useProfile(user?.id)
  const [activeTab, setActiveTab] = useState<Tab>('vehicles')
  const [unreadCount, setUnreadCount] = useState(0)
  const navigate = useNavigate()

  // Count scan events newer than the last time the user viewed Scan History
  useEffect(() => {
    if (!user?.id) return
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString()
    supabase
      .from('scan_events')
      .select('id', { count: 'exact', head: true })
      .gt('scanned_at', lastSeen)
      .then(({ count }) => setUnreadCount(count ?? 0))
  }, [user?.id])

  // Handle foreground FCM messages — increment unread badge in real time
  useEffect(() => {
    initForegroundMessaging()
    function onNewScan() { setUnreadCount((n) => n + 1) }
    window.addEventListener('parkpeace:new-scan', onNewScan)
    return () => window.removeEventListener('parkpeace:new-scan', onNewScan)
  }, [])

  // Clear badge when app is foregrounded
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        navigator.clearAppBadge?.()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    navigator.clearAppBadge?.()
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    if (tab === 'history') {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
      setUnreadCount(0)
      navigator.clearAppBadge?.()
    }
  }

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  // Redirect new users to profile setup exactly once
  if (localStorage.getItem('parkpeace_new_user') === 'true') {
    localStorage.removeItem('parkpeace_new_user')
    return <Navigate to="/profile" replace />
  }

  const displayName = profile?.full_name?.trim() || user.email || 'Account'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/favicon.png" alt="ParkPeace" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-gray-900">ParkPeace</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-700 text-xs font-medium transition-colors truncate max-w-[160px]"
            >
              <UserCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{displayName}</span>
            </button>
            <HelpButton />
            <ContactDeveloper />
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4">
          <nav className="flex gap-1">
            {([
              { id: 'vehicles' as Tab, label: 'My Vehicles', icon: <QrCode className="w-4 h-4" /> },
              { id: 'history' as Tab, label: 'Scan History', icon: <Clock className="w-4 h-4" /> },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === 'history' && unreadCount > 0 && (
                  <span className="absolute -top-0.5 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'vehicles' && (
          <QRCodeManager userId={user.id} />
        )}
        {activeTab === 'history' && (
          <ScanHistory />
        )}
      </main>
    </div>
  )
}
