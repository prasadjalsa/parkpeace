import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { sessionId } = await req.json() as { sessionId: string }

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .select("id, expires_at, scanner_name")
      .eq("id", sessionId)
      .single()

    if (error || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (new Date(session.expires_at) <= new Date()) {
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Return only the fields the scanner needs — no owner_id, no phone numbers
    return new Response(
      JSON.stringify({
        id: session.id,
        expires_at: session.expires_at,
        scanner_name: session.scanner_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
