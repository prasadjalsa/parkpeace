import { Navigate, useNavigate } from 'react-router-dom'
import { Car, ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { ProfileForm } from '../components/dashboard/ProfileForm'
import { HelpButton } from '../components/auth/HelpSection'

export function ProfilePage() {
  const { user, loading } = useAuth()
  const { profile, saveProfile } = useProfile(user?.id)
  const navigate = useNavigate()

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-2 ml-1">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <Car className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-gray-900">Profile</span>
            </div>
          </div>
          <HelpButton />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        <ProfileForm profile={profile} onSave={saveProfile} />
      </main>
    </div>
  )
}
