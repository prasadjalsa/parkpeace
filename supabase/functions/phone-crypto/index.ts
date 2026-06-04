import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getKey(): string {
  const key = Deno.env.get("PHONE_ENCRYPTION_KEY")
  if (!key) throw new Error("PHONE_ENCRYPTION_KEY not set")
  return key
}

async function encryptPhone(supabase: ReturnType<typeof createClient>, value: string): Promise<string> {
  const { data, error } = await supabase.rpc("encrypt_phone", { p_value: value, p_key: getKey() })
  if (error) throw new Error(`Encrypt error: ${error.message}`)
  return data as string
}

async function decryptPhone(supabase: ReturnType<typeof createClient>, value: string): Promise<string> {
  if (!value) return value
  const { data, error } = await supabase.rpc("decrypt_phone", { p_value: value, p_key: getKey() })
  if (error) throw new Error(`Decrypt error: ${error.message}`)
  return data as string
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Must be authenticated
    const authHeader = req.headers.get("authorization") ?? ""
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { action, fields } = await req.json() as {
      action: "encrypt" | "decrypt"
      fields: Record<string, string | null>
    }

    if (!action || !fields) {
      return new Response(JSON.stringify({ error: "Missing action or fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const result: Record<string, string | null> = {}
    for (const [key, value] of Object.entries(fields)) {
      if (!value) { result[key] = value; continue }
      result[key] = action === "encrypt"
        ? await encryptPhone(supabaseAdmin, value)
        : await decryptPhone(supabaseAdmin, value)
    }

    return new Response(JSON.stringify(result), {
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
