import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { isRateLimited } from "../_shared/rate-limit.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

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
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

    if (action === "check") {
      // Count recent failures for this email
      const { count } = await supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", email.toLowerCase())
        .gte("failed_at", windowStart)

      const attempts = count ?? 0
      const locked = attempts >= MAX_ATTEMPTS
      const remaining = Math.max(0, MAX_ATTEMPTS - attempts)

      return new Response(JSON.stringify({
        locked,
        attempts,
        remaining,
        lockoutMinutes: locked ? WINDOW_MINUTES : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (action === "record_failure") {
      // Rate limit: max 10 record_failure calls per IP per 5 minutes
      // Prevents attacker from locking out someone else's account
      if (await isRateLimited(`lockout-record:${ip}`, 10, 300)) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      await supabase.from("login_attempts").insert({
        email: email.toLowerCase(),
        ip,
      })

      // Return updated count
      const { count } = await supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", email.toLowerCase())
        .gte("failed_at", windowStart)

      const attempts = count ?? 0
      const locked = attempts >= MAX_ATTEMPTS

      return new Response(JSON.stringify({
        locked,
        attempts,
        remaining: Math.max(0, MAX_ATTEMPTS - attempts),
        lockoutMinutes: locked ? WINDOW_MINUTES : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (action === "reset") {
      // Clear attempts on successful login
      await supabase
        .from("login_attempts")
        .delete()
        .eq("email", email.toLowerCase())

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
