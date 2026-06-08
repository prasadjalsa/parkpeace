import { supabase } from './supabase'

const ALLOWED_ACTIONS = new Set([
  'sign_in', 'account_deleted',
  'qr_created', 'qr_deleted', 'profile_updated',
])

// Client-side rate limit — max 20 audit entries per hour per session
function isRateLimited(): boolean {
  const key = `audit_rate_${new Date().toISOString().slice(0, 13)}`
  const count = parseInt(localStorage.getItem(key) ?? '0', 10)
  if (count >= 20) return true
  localStorage.setItem(key, (count + 1).toString())
  return false
}

export async function auditLog(
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!ALLOWED_ACTIONS.has(action)) return
  if (isRateLimited()) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('audit_log').insert({
      user_id: session.user.id,
      // user_email is set by a DB trigger from auth.users — not trusted from frontend
      action,
      details: details ?? null,
    })
  } catch {
    // Non-critical — never block user actions
  }
}
