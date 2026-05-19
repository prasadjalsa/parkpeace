import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Car, LogOut, User, QrCode, Clock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { ProfileForm } from '../components/dashboard/ProfileForm'
import { QRCodeManager } from '../components/dashboard/QRCodeManager'
import { ScanHistory } from '../components/dashboard/ScanHistory'

type Tab = 'profile' | 'qrcodes' | 'history'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'qrcodes', label: 'My QR Codes', icon: <QrCode className="w-4 h-4" /> },
  { id: 'history', label: 'Scan History', icon: <Clock className="w-4 h-4" /> },
]

export function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const { profile, saveProfile } = useProfile(user?.id)
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // If the user's FCM token was already saved, nothing to do here.
  // Token registration happens in ProfileForm when user clicks "Enable Notifications".
  useEffect(() => {}, [user?.id])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

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
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[180px]">
              {user.email}
            </span>
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
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'profile' && (
          <ProfileForm profile={profile} onSave={saveProfile} />
        )}
        {activeTab === 'qrcodes' && (
          <QRCodeManager userId={user.id} />
        )}
        {activeTab === 'history' && (
          <ScanHistory userId={user.id} />
        )}
      </main>
    </div>
  )
}
