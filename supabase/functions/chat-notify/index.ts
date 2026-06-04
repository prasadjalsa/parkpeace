import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── FCM v1 helpers (same as notify-owner) ─────────────────────────────────────

function toBase64url(obj: unknown): string {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "")
  const binary = atob(pemBody)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return crypto.subtle.importKey(
    "pkcs8",
    buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

async function rsaSign(data: string, privateKey: CryptoKey): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoded)
  let binary = ""
  new Uint8Array(signature).forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

async function buildJWT(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = toBase64url({ alg: "RS256", typ: "JWT" })
  const payload = toBase64url({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })
  const signingInput = `${header}.${payload}`
  const privateKey = await importPrivateKey(privateKeyPem)
  const signature = await rsaSign(signingInput, privateKey)
  return `${signingInput}.${signature}`
}

async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const jwt = await buildJWT(clientEmail, privateKeyPem)
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function sendFCMPush(
  fcmToken: string,
  title: string,
  body: string,
  projectId: string,
  accessToken: string,
  data?: Record<string, string>,
) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: data ?? {},
          android: { priority: "high" },
          apns: { headers: { "apns-priority": "10" } },
        },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    console.error("FCM error:", err)
  }
}

// ── Rate limiting via in-memory Map ──────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string, max: number, windowSecs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowSecs * 1000 })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  return false
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let parsedBody: unknown
  try {
    parsedBody = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

    const { sessionId, senderRole, body } = parsedBody as {
      sessionId: string
      senderRole: "scanner" | "owner"
      body: string
    }

    if (!sessionId || !senderRole || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (body.length > 2000) {
      return new Response(JSON.stringify({ error: "Message too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Owner must be authenticated; scanner calls with anon key
    if (senderRole === "owner") {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      // Verify the authenticated user actually owns this session
      const { data: sessionCheck } = await supabase
        .from("chat_sessions")
        .select("owner_id")
        .eq("id", sessionId)
        .single()
      if (!sessionCheck || sessionCheck.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    } else {
      // Scanner: must be calling with the anon key (not a user session)
      if (token !== anonKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    // Rate limit: max 60 notifications per session per hour
    if (isRateLimited(`chat-notify:${sessionId}`, 60, 3600)) {
      return new Response(JSON.stringify({ error: "Too many requests." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch session + owner FCM token + scanner FCM token
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id, owner_id, scanner_name, scanner_fcm_token, expires_at, qr_code_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
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

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const sa = JSON.parse(serviceAccountJson)
    const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://parkpeace.vercel.app"
    const chatUrl = `${appOrigin}/chat/${sessionId}`

    if (senderRole === "scanner") {
      // Scanner sent a message → notify the owner
      const { data: profile } = await supabase
        .from("profiles")
        .select("fcm_token")
        .eq("id", session.owner_id)
        .single()

      if (profile?.fcm_token) {
        const accessToken = await getAccessToken(sa.client_email, sa.private_key)
        const preview = body.length > 60 ? body.slice(0, 60) + "…" : body
        await sendFCMPush(
          profile.fcm_token,
          `${session.scanner_name}: new message`,
          preview,
          sa.project_id,
          accessToken,
          { chatUrl },
        )
      }
    } else {
      // Owner sent a message → notify the scanner (if they opted in)
      if (session.scanner_fcm_token) {
        const accessToken = await getAccessToken(sa.client_email, sa.private_key)
        const preview = body.length > 60 ? body.slice(0, 60) + "…" : body
        await sendFCMPush(
          session.scanner_fcm_token,
          "Owner replied",
          preview,
          sa.project_id,
          accessToken,
          { chatUrl },
        )
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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
