import { supabase } from './supabase'

const PHONE_FIELDS = ['phone', 'whatsapp_number', 'emergency_phone', 'scanner_phone'] as const

async function callPhoneCrypto(
  action: 'encrypt' | 'decrypt',
  fields: Record<string, string | null>,
): Promise<Record<string, string | null>> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-crypto`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, fields }),
    },
  )
  if (!res.ok) throw new Error(`phone-crypto ${action} failed`)
  return res.json()
}

export async function encryptPhoneFields<T extends Record<string, unknown>>(data: T): Promise<T> {
  const toEncrypt: Record<string, string | null> = {}
  for (const f of PHONE_FIELDS) {
    if (f in data) toEncrypt[f] = (data[f] as string | null) ?? null
  }
  if (Object.keys(toEncrypt).length === 0) return data
  const encrypted = await callPhoneCrypto('encrypt', toEncrypt)
  return { ...data, ...encrypted }
}

export async function decryptPhoneFields<T extends Record<string, unknown>>(data: T): Promise<T> {
  const toDecrypt: Record<string, string | null> = {}
  for (const f of PHONE_FIELDS) {
    if (f in data) toDecrypt[f] = (data[f] as string | null) ?? null
  }
  if (Object.keys(toDecrypt).length === 0) return data
  const decrypted = await callPhoneCrypto('decrypt', toDecrypt)
  return { ...data, ...decrypted }
}
