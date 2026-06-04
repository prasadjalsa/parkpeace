import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Don't expose session while OTP is pending
      if (sessionStorage.getItem('otp_pending') === 'true') {
        setSession(null)
      } else {
        setSession(session)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Don't expose session while OTP is pending
      if (sessionStorage.getItem('otp_pending') === 'true') {
        setSession(null)
      } else {
        setSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const user: User | null = session?.user ?? null

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { session, loading, user, signOut }
}
