import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  full_name: string | null
  phone: string
  emergency_name: string | null
  emergency_phone: string | null
  emergency_rel: string | null
  fcm_token: string | null
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function saveProfile(updates: Partial<Omit<Profile, 'id'>>) {
    if (!userId) return { error: new Error('Not logged in') }
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (!error) setProfile(data)
    return { error }
  }

  return { profile, loading, saveProfile, refetch: fetchProfile }
}
