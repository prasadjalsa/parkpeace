import { supabase } from './supabase'

const PHONE_FIELDS = ['phone', 'whatsapp_number', 'emergency_phone', 'scanner_phone'] as const

// Detect if a value looks like pgcrypto base64 ciphertext
// pgp_sym_encrypt output base64-encoded starts with 'ww0E' in PostgreSQL
function isEncrypted(value: string | null): boolean {
  return typeof value === 'string' && (value.startsWith('ww0E') || value.startsWith('hQ'))
}

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
  if (!res.ok) return fields  // fail open — return originals
  return res.json()
}

export async function encryptPhoneFields<T extends Record<string, unknown>>(data: T): Promise<T> {
  const toEncrypt: Record<string, string | null> = {}
  for (const f of PHONE_FIELDS) {
    if (f in data) {
      const val = (data[f] as string | null) ?? null
      // Don't double-encrypt already-encrypted values
      if (val && !isEncrypted(val)) toEncrypt[f] = val
    }
  }
  if (Object.keys(toEncrypt).length === 0) return data
  const encrypted = await callPhoneCrypto('encrypt', toEncrypt)
  return { ...data, ...encrypted }
}

export async function decryptPhoneFields<T extends Record<string, unknown>>(data: T): Promise<T> {
  const toDecrypt: Record<string, string | null> = {}
  for (const f of PHONE_FIELDS) {
    if (f in data) {
      const val = (data[f] as string | null) ?? null
      // Only decrypt values that look encrypted
      if (val && isEncrypted(val)) toDecrypt[f] = val
    }
  }
  if (Object.keys(toDecrypt).length === 0) return data
  const decrypted = await callPhoneCrypto('decrypt', toDecrypt)
  return { ...data, ...decrypted }
}
