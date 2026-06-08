import { supabase } from './supabase'

export async function auditLog(
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('audit_log').insert({
      user_id: session.user.id,
      user_email: session.user.email,
      action,
      details: details ?? null,
    })
  } catch {
    // Non-critical — never block user actions
  }
}
