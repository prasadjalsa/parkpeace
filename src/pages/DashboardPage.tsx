import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Car, LogOut, QrCode, Clock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { QRCodeManager } from '../components/dashboard/QRCodeManager'
import { ScanHistory } from '../components/dashboard/ScanHistory'
import { HelpButton } from '../components/auth/HelpSection'

type Tab = 'vehicles' | 'history'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'vehicles', label: 'My Vehicles', icon: <QrCode className="w-4 h-4" /> },
  { id: 'history', label: 'Scan History', icon: <Clock className="w-4 h-4" /> },
]

export function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const { profile } = useProfile(user?.id)
  const [activeTab, setActiveTab] = useState<Tab>('vehicles')
  const navigate = useNavigate()

  useEffect(() => {}, [user?.id])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  const displayName = profile?.full_name?.trim() || user.email || 'Account'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">ParkPeace</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/profile')}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors truncate max-w-[160px]"
            >
              {displayName}
            </button>
            <HelpButton />
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
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
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
          <ScanHistory userId={user.id} />
        )}
      </main>
    </div>
  )
}
