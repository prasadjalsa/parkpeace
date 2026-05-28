import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── FCM v1 helpers ─────────────────────────────────────────────────────────────

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

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("authorization") ?? ""
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { message } = await req.json() as { message: string }

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (message.trim().length > 2000) {
      return new Response(JSON.stringify({ error: "Message too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Insert into contact_developer using service role to bypass RLS insert check
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )
    await supabaseAdmin.from("contact_developer").insert({
      user_id: user.id,
      user_email: user.email,
      message: message.trim(),
    })

    // Send FCM push to developer device
    const devFcmToken = Deno.env.get("DEVELOPER_FCM_TOKEN")
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if (devFcmToken && serviceAccountJson) {
      try {
        const sa = JSON.parse(serviceAccountJson)
        const accessToken = await getAccessToken(sa.client_email, sa.private_key)
        const preview = message.trim().length > 80 ? message.trim().slice(0, 80) + "…" : message.trim()
        await sendFCMPush(
          devFcmToken,
          `ParkPeace: message from ${user.email}`,
          preview,
          sa.project_id,
          accessToken,
        )
      } catch (err) {
        console.error("FCM push to developer failed:", err)
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
