import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { encryptPhoneFields, decryptPhoneFields } from '../lib/phoneCrypto'

export interface Profile {
  id: string
  full_name: string | null
  phone: string
  whatsapp_number: string | null
  emergency_name: string | null
  emergency_phone: string | null
  emergency_rel: string | null
  fcm_token: string | null
  is_developer: boolean
  otp_enabled: boolean
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
    if (data) {
      const decrypted = await decryptPhoneFields(data as unknown as Record<string, unknown>)
      setProfile(decrypted as unknown as Profile)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function saveProfile(updates: Partial<Omit<Profile, 'id'>>) {
    if (!userId) return { error: new Error('Not logged in') }
    const encrypted = await encryptPhoneFields(updates as Record<string, unknown>)
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...encrypted, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (!error && data) {
      const decrypted = await decryptPhoneFields(data as unknown as Record<string, unknown>)
      setProfile(decrypted as unknown as Profile)
    }
    return { error }
  }

  return { profile, loading, saveProfile, refetch: fetchProfile }
}
