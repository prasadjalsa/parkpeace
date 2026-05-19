import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthForm } from '../components/auth/AuthForm'

export function AuthPage() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return <AuthForm />
}
