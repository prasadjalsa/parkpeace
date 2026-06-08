import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export async function auditLog(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  userEmail: string | null,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      user_id: userId,
      user_email: userEmail,
      action,
      details: details ?? null,
    })
  } catch (err) {
    console.error("Audit log failed:", err)
  }
}
