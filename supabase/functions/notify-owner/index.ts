import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── FCM v1 helpers ────────────────────────────────────────────────────────────

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
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
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

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { qrCodeId, scannerName, scannerPhone, note, action } = await req.json() as {
      qrCodeId: string
      scannerName: string
      scannerPhone?: string
      note: string
      action: "contact" | "emergency"
    }

    if (!qrCodeId || !scannerName || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Admin Supabase client — bypasses RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Fetch QR code
    const { data: qrCode, error: qrError } = await supabase
      .from("qr_codes")
      .select("id, name, user_id")
      .eq("id", qrCodeId)
      .single()

    if (qrError || !qrCode) {
      return new Response(JSON.stringify({ error: "QR code not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch owner profile separately (no direct FK from qr_codes to profiles)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, whatsapp_number, emergency_name, emergency_phone, fcm_token")
      .eq("id", qrCode.user_id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Owner profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Build notification content
    const pushTitle = action === "emergency"
      ? `🚨 Emergency: ${qrCode.name}`
      : `ParkPeace: ${qrCode.name}`
    const pushBody = action === "emergency"
      ? `${scannerName} reports: ${note ?? "emergency"}`
      : `${scannerName} scanned your QR${note ? ` — "${note}"` : ""}`

    // Create chat session first (contact only) so we can link it to the scan event
    let chatSessionId: string | null = null
    if (action === "contact") {
      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({
          qr_code_id: qrCodeId,
          owner_id: qrCode.user_id,
          scanner_name: scannerName,
          scanner_phone: scannerPhone ?? null,
        })
        .select("id")
        .single()

      if (!sessionError && session) {
        chatSessionId = session.id
      } else {
        console.error("Failed to create chat session:", sessionError)
      }
    }

    // Log the scan event (with chat session link if available)
    await supabase.from("scan_events").insert({
      qr_code_id: qrCodeId,
      action,
      scanner_name: scannerName,
      scanner_phone: scannerPhone ?? null,
      scanner_note: note ?? null,
      chat_session_id: chatSessionId,
    })

    // Send FCM push notification if the owner has a token
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if (serviceAccountJson && profile.fcm_token) {
      try {
        const sa = JSON.parse(serviceAccountJson)
        const accessToken = await getAccessToken(sa.client_email, sa.private_key)
        const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://parkpeace.vercel.app"
        const fcmData: Record<string, string> = {}
        if (chatSessionId) fcmData.chatUrl = `${appOrigin}/chat/${chatSessionId}`
        await sendFCMPush(profile.fcm_token, pushTitle, pushBody, sa.project_id, accessToken, fcmData)
      } catch (err) {
        // Log FCM errors but don't fail the request — event is still logged
        console.error("FCM push failed:", err)
      }
    }

    // Build response
    const response: Record<string, unknown> = { success: true }
    if (action === "emergency" && profile.emergency_phone) {
      response.emergencyPhone = profile.emergency_phone
    }
    if (action === "contact") {
      if (profile.whatsapp_number) {
        response.whatsappNumber = profile.whatsapp_number
        response.carName = qrCode.name
      }
      if (chatSessionId) {
        response.chatSessionId = chatSessionId
      }
    }

    return new Response(JSON.stringify(response), {
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
