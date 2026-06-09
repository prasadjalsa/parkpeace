import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { isRateLimited } from "../_shared/rate-limit.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MAX_ATTEMPTS = 5

// Exponential lockout windows in minutes — capped at 120
function getLockoutMinutes(lockoutCount: number): number {
  const windows = [15, 30, 60, 120]
  return windows[Math.min(lockoutCount, windows.length - 1)]
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email, action } = await req.json() as {
      email: string
      action: "check" | "record_failure" | "reset"
    }

    if (!email || !action) {
      return new Response(JSON.stringify({ error: "Missing email or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
    const emailLower = email.toLowerCase()

    // Get current lockout count from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("lockout_count, last_lockout_at")
      .eq("id", (await supabase.auth.admin.getUserByEmail(emailLower)).data?.user?.id ?? "")
      .single()

    const lockoutCount = profile?.lockout_count ?? 0
    const lockoutMinutes = getLockoutMinutes(lockoutCount)
    const windowStart = new Date(Date.now() - lockoutMinutes * 60 * 1000).toISOString()

    if (action === "check") {
      const { count } = await supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", emailLower)
        .gte("failed_at", windowStart)

      const attempts = count ?? 0
      const locked = attempts >= MAX_ATTEMPTS
      const remaining = Math.max(0, MAX_ATTEMPTS - attempts)

      return new Response(JSON.stringify({
        locked,
        attempts,
        remaining,
        lockoutMinutes: locked ? lockoutMinutes : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (action === "record_failure") {
      // Rate limit: max 10 record_failure calls per IP per 5 minutes
      if (await isRateLimited(`lockout-record:${ip}`, 10, 300)) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      await supabase.from("login_attempts").insert({ email: emailLower, ip })

      const { count } = await supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", emailLower)
        .gte("failed_at", windowStart)

      const attempts = count ?? 0
      const justLocked = attempts >= MAX_ATTEMPTS

      // On first lockout — increment lockout_count and record timestamp
      if (justLocked && attempts === MAX_ATTEMPTS) {
        const userId = (await supabase.auth.admin.getUserByEmail(emailLower)).data?.user?.id
        if (userId) {
          await supabase.from("profiles")
            .update({
              lockout_count: lockoutCount + 1,
              last_lockout_at: new Date().toISOString(),
            })
            .eq("id", userId)
        }
      }

      return new Response(JSON.stringify({
        locked: justLocked,
        attempts,
        remaining: Math.max(0, MAX_ATTEMPTS - attempts),
        lockoutMinutes: justLocked ? getLockoutMinutes(lockoutCount + 1) : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (action === "reset") {
      // Clear attempts on successful login — reset lockout_count too
      await supabase.from("login_attempts").delete().eq("email", emailLower)

      const userId = (await supabase.auth.admin.getUserByEmail(emailLower)).data?.user?.id
      if (userId) {
        await supabase.from("profiles")
          .update({ lockout_count: 0, last_lockout_at: null })
          .eq("id", userId)
      }

      return new Response(JSON.stringify({ reset: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
