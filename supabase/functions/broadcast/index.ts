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
): Promise<{ ok: boolean; reason?: string }> {
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
          data: { chatUrl: `/dashboard?announce=${encodeURIComponent(title)}|${encodeURIComponent(body)}` },
          android: { priority: "high" },
          apns: { headers: { "apns-priority": "10" } },
        },
      }),
    },
  )
  if (!res.ok) {
    const errText = await res.text()
    let reason = "Unknown error"
    try {
      const errJson = JSON.parse(errText)
      const status = errJson?.error?.status ?? ""
      if (status === "UNREGISTERED" || status === "INVALID_ARGUMENT") {
        reason = "Token expired or device unregistered — user needs to re-enable notifications"
      } else if (status === "QUOTA_EXCEEDED") {
        reason = "FCM quota exceeded — try again later"
      } else if (status === "UNAVAILABLE") {
        reason = "FCM service unavailable — try again later"
      } else if (status === "INTERNAL") {
        reason = "FCM internal error"
      } else {
        reason = errJson?.error?.message ?? errText
      }
    } catch {
      reason = errText.slice(0, 100)
    }
    console.error("FCM error:", reason, "| token:", fcmToken.slice(0, 20))
    return { ok: false, reason }
  }
  return { ok: true }
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify broadcast secret — must match BROADCAST_SECRET env var
    const authHeader = req.headers.get("authorization") ?? ""
    const secret = Deno.env.get("BROADCAST_SECRET")
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { title, body, testUserIds } = await req.json() as {
      title: string
      body: string
      testUserIds?: string[]
    }

    if (!title?.trim() || !body?.trim()) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT_JSON not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch all FCM tokens from profiles — join with auth.users for email
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )
    // Fetch FCM tokens — all users or specific test users
    let profileQuery = supabase
      .from("profiles")
      .select("id, full_name, fcm_token")
      .not("fcm_token", "is", null)

    if (testUserIds && testUserIds.length > 0) {
      profileQuery = profileQuery.in("id", testUserIds)
    }

    const { data: profiles, error } = await profileQuery

    if (error) throw new Error(`DB error: ${error.message}`)

    // Fetch emails from auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const emailMap: Record<string, string> = {}
    for (const u of authUsers?.users ?? []) {
      emailMap[u.id] = u.email ?? ''
    }

    if ((profiles ?? []).length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, message: "No registered devices" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const sa = JSON.parse(serviceAccountJson)
    const accessToken = await getAccessToken(sa.client_email, sa.private_key)

    // Send to all tokens — sequential to avoid rate limits
    let sent = 0
    let failed = 0
    const failedUsers: { id: string; full_name: string; email: string; reason: string }[] = []
    const successUsers: { id: string; full_name: string; email: string }[] = []

    for (const profile of (profiles ?? []) as { id: string; full_name: string | null; fcm_token: string }[]) {
      const result = await sendFCMPush(profile.fcm_token, title.trim(), body.trim(), sa.project_id, accessToken)
      if (result.ok) {
        sent++
        successUsers.push({
          id: profile.id,
          full_name: profile.full_name ?? 'Unknown',
          email: emailMap[profile.id] ?? 'Unknown',
        })
      } else {
        failed++
        failedUsers.push({
          id: profile.id,
          full_name: profile.full_name ?? 'Unknown',
          email: emailMap[profile.id] ?? 'Unknown',
          reason: result.reason ?? 'Unknown error',
        })
      }
    }

    const isTest = testUserIds && testUserIds.length > 0
    console.log(`Broadcast ${isTest ? '(TEST) ' : ''}complete — sent: ${sent}, failed: ${failed}, total: ${(profiles ?? []).length}`)
    if (failedUsers.length > 0) {
      console.log(`Failed users: ${JSON.stringify(failedUsers)}`)
    }

    return new Response(JSON.stringify({
      success: true,
      summary: `${sent} delivered, ${failed} failed out of ${(profiles ?? []).length} total`,
      sent,
      failed,
      total: (profiles ?? []).length,
      deliveredTo: successUsers.length > 0 ? successUsers.map(u => `${u.full_name} (${u.email})`) : undefined,
      failedUsers: failedUsers.length > 0 ? failedUsers.map(u => ({
        name: u.full_name,
        email: u.email,
        reason: u.reason,
      })) : undefined,
    }), {
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
