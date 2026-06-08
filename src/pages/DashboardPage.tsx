import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { LogOut, QrCode, Clock, UserCircle, Mail, X, Megaphone, Bell, Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { initForegroundMessaging, clearCorruptedFCMState } from '../lib/firebase'
import { QRCodeManager } from '../components/dashboard/QRCodeManager'
import { ScanHistory } from '../components/dashboard/ScanHistory'
import { DeveloperInbox } from '../components/dashboard/DeveloperInbox'
import { AuditLog } from '../components/dashboard/AuditLog'
import { HelpButton } from '../components/auth/HelpSection'

type Tab = 'vehicles' | 'history' | 'inbox' | 'audit'

const LAST_SEEN_KEY = 'scan_history_last_seen'
const INBOX_LAST_SEEN_KEY = 'inbox_last_seen'

export function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const { profile } = useProfile(user?.id)
  const [searchParams] = useSearchParams()
  const openHelp = searchParams.get('help') === 'true'
  const tabFromUrl = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(tabFromUrl ?? 'vehicles')
  const [unreadCount, setUnreadCount] = useState(0)
  const [inboxCount, setInboxCount] = useState(0)
  const navigate = useNavigate()

  // Parse announcement from broadcast notification tap
  const announceParam = searchParams.get('announce')
  const [announcement, setAnnouncement] = useState<{ title: string; body: string } | null>(() => {
    if (!announceParam) return null
    const parts = announceParam.split('|')
    return { title: decodeURIComponent(parts[0] ?? ''), body: decodeURIComponent(parts[1] ?? '') }
  })

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

  // Count unread inbox messages for developer
  useEffect(() => {
    if (!profile?.is_developer) return
    const lastSeen = localStorage.getItem(INBOX_LAST_SEEN_KEY) ?? new Date(0).toISOString()
    supabase
      .from('contact_developer')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastSeen)
      .then(({ count }) => setInboxCount(count ?? 0))
  }, [profile?.is_developer])

  // Handle foreground FCM messages — increment unread badge in real time
  useEffect(() => {
    // Clear any corrupted Firebase IndexedDB state left by the 2026-06-06 outage.
    // Runs once per browser profile then self-disables via localStorage gate.
    clearCorruptedFCMState()
    initForegroundMessaging()
    function onNewScan() { setUnreadCount((n) => n + 1) }
    window.addEventListener('parkpeace:new-scan', onNewScan)
    return () => window.removeEventListener('parkpeace:new-scan', onNewScan)
  }, [])

  // Auto-refresh FCM token on every dashboard load — prevents 60-day expiry
  // for users who open the app but don't explicitly re-enable notifications.
  useEffect(() => {
    if (!user?.id || Notification.permission !== 'granted') return
    import('../lib/firebase').then(({ requestFCMToken }) => {
      requestFCMToken().then((result) => {
        if ('token' in result) {
          supabase.from('profiles')
            .update({ fcm_token: result.token, fcm_token_updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => {})
        }
      })
    })
  }, [user?.id])

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
    if (tab === 'inbox') {
      localStorage.setItem(INBOX_LAST_SEEN_KEY, new Date().toISOString())
      setInboxCount(0)
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
            <HelpButton autoOpen={openHelp} />
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
              { id: 'vehicles' as Tab, label: 'My QR Codes', icon: <QrCode className="w-4 h-4" /> },
              { id: 'history' as Tab, label: 'Scan History', icon: <Clock className="w-4 h-4" /> },
              ...(profile?.is_developer ? [
                { id: 'inbox' as Tab, label: 'Inbox', icon: <Mail className="w-4 h-4" /> },
                { id: 'audit' as Tab, label: 'Audit Log', icon: <Shield className="w-4 h-4" /> },
              ] : []),
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
                {tab.id === 'inbox' && inboxCount > 0 && (
                  <span className="absolute -top-0.5 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {inboxCount > 99 ? '99+' : inboxCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Push notification banner — shown if permission not granted */}
      {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
        <div className="bg-primary-50 border-b border-primary-100">
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-primary-700">
              <Bell className="w-4 h-4 shrink-0" />
              <span>Enable push notifications to get instant alerts when someone scans your QR.</span>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="shrink-0 text-xs font-semibold text-primary-700 hover:text-primary-900 transition-colors whitespace-nowrap"
            >
              Enable now →
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'vehicles' && (
          <QRCodeManager userId={user.id} />
        )}
        {activeTab === 'history' && (
          <ScanHistory />
        )}
        {activeTab === 'inbox' && profile?.is_developer && (
          <DeveloperInbox />
        )}
        {activeTab === 'audit' && profile?.is_developer && (
          <AuditLog />
        )}
      </main>

      {/* Broadcast announcement popup */}
      {announcement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="bg-primary-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-white" />
                <h2 className="font-semibold text-white text-sm">{announcement.title}</h2>
              </div>
              <button onClick={() => setAnnouncement(null)} className="text-white/70 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 leading-relaxed">{announcement.body}</p>
              <button
                onClick={() => setAnnouncement(null)}
                className="btn-primary w-full mt-4"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
