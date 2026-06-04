import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Persistent rate limiter backed by Supabase — survives cold starts.
 * Returns true if the request should be blocked (limit exceeded).
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowSecs: number,
): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  const now = new Date()
  const resetAt = new Date(now.getTime() + windowSecs * 1000).toISOString()

  // Upsert: insert row or increment count if key exists and hasn't expired.
  // If expired, replace with fresh count of 1.
  const { data, error } = await supabase.rpc("upsert_rate_limit", {
    p_key: key,
    p_max: max,
    p_reset_at: resetAt,
  })

  if (error) {
    // Fail open on DB error — don't block legitimate requests
    console.error("Rate limit DB error:", error.message)
    return false
  }

  // Function returns true if limit exceeded
  return data === true
}
