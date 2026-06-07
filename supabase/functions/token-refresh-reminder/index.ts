import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── FCM v1 helpers (same pattern as notify-owner) ─────────────────────────────

function toBase64url(obj: unknown): string {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "")
  const binary = atob(pemBody)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return crypto.subtle.importKey("pkcs8", buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
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
  const payload = toBase64url({ iss: clientEmail, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })
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

async function sendFCMPush(fcmToken: string, title: string, body: string, projectId: string, accessToken: string, data?: Record<string, string>) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: data ?? {},
        android: { priority: "high" },
        apns: { headers: { "apns-priority": "10" } },
      },
    }),
  })
  if (!res.ok) console.error("FCM error:", await res.text())
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify secret — called by pg_cron via HTTP
    const authHeader = req.headers.get("authorization") ?? ""
    const secret = Deno.env.get("BROADCAST_SECRET")
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const now = new Date()

    // Find users whose FCM token was last updated 50, 55, or 58 days ago
    // We send on these exact days to avoid repeated notifications
    const reminders = [
      {
        days: 58, level: "critical",
        title: "⛔ Notifications expiring in 2 days",
        body: "Open ParkPeace now to keep receiving alerts. Takes just a second.",
        popup: "✅ Notification token refreshed! You're all set for the next 60 days.",
      },
      {
        days: 55, level: "warning",
        title: "⚠️ Notifications expiring in 5 days",
        body: "Open ParkPeace to refresh your notification token before it expires.",
        popup: "✅ Notification token refreshed! You're all set for the next 60 days.",
      },
      {
        days: 50, level: "alert",
        title: "🔔 Notifications expire in 10 days",
        body: "Open ParkPeace soon to keep your scan alerts active.",
        popup: "✅ Notification token refreshed! You're all set for the next 60 days.",
      },
    ]

    const sa = JSON.parse(serviceAccountJson)
    const accessToken = await getAccessToken(sa.client_email, sa.private_key)

    // Fetch developer FCM token for inbox notification
    const { data: devProfile } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("is_developer", true)
      .not("fcm_token", "is", null)
      .limit(1)
      .single()

    // Fetch emails for reporting
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const emailMap: Record<string, string> = {}
    for (const u of authUsers?.users ?? []) {
      emailMap[u.id] = u.email ?? 'Unknown'
    }

    let totalSent = 0
    const criticalUsers: string[] = []

    for (const reminder of reminders) {
      const from = new Date(now.getTime() - (reminder.days + 1) * 86_400_000).toISOString()
      const to   = new Date(now.getTime() - reminder.days * 86_400_000).toISOString()

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, fcm_token")
        .not("fcm_token", "is", null)
        .gte("fcm_token_updated_at", from)
        .lt("fcm_token_updated_at", to)

      for (const profile of (profiles ?? []) as { id: string; full_name: string | null; fcm_token: string }[]) {
        const announceUrl = `/dashboard?announce=${encodeURIComponent(reminder.title)}|${encodeURIComponent(reminder.popup)}`
        await sendFCMPush(profile.fcm_token, reminder.title, reminder.body, sa.project_id, accessToken, { chatUrl: announceUrl })
        totalSent++
        console.log(`Sent ${reminder.level} reminder to user ${profile.id}`)

        // On day 58 (critical) — log to developer inbox and send developer a push
        if (reminder.level === "critical") {
          const userName = profile.full_name ?? 'Unknown'
          const userEmail = emailMap[profile.id] ?? 'Unknown'
          criticalUsers.push(`${userName} (${userEmail})`)

          await supabase.from("contact_developer").insert({
            user_id: profile.id,
            user_email: userEmail,
            message: `⛔ FCM token expiry alert: ${userName} (${userEmail}) has not opened the app in 58 days. Their push notifications will expire in 2 days.`,
          })
        }
      }
    }

    // Send developer a single summary push if any critical users
    if (criticalUsers.length > 0 && devProfile?.fcm_token) {
      const devTitle = `⛔ ${criticalUsers.length} user${criticalUsers.length > 1 ? 's' : ''} near FCM expiry`
      const devBody = `${criticalUsers.join(', ')} — notifications expire in 2 days.`
      await sendFCMPush(
        devProfile.fcm_token,
        devTitle,
        devBody,
        sa.project_id,
        accessToken,
        { chatUrl: `/dashboard?announce=${encodeURIComponent(devTitle)}|${encodeURIComponent(devBody)}` },
      )
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
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
