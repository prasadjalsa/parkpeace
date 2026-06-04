import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Check if OTP is enabled for this user
    const { data: profile } = await supabase
      .from("profiles")
      .select("otp_enabled")
      .eq("id", user.id)
      .single()

    if (!profile?.otp_enabled) {
      return new Response(JSON.stringify({ otpRequired: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Invalidate any existing unused OTP for this user
    await supabase
      .from("otp_challenges")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false)

    // Generate and store new OTP
    const code = generateOTP()
    await supabase.from("otp_challenges").insert({
      user_id: user.id,
      code,
    })

    // Send via Supabase Auth admin email (uses configured mailer)
    const appOrigin = Deno.env.get("APP_ORIGIN") ?? "https://parkpeace.vercel.app"
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#4F46E5;padding:32px;text-align:center;">
            <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">ParkPeace</span>
            <p style="margin:6px 0 0;font-size:13px;color:#C7D2FE;">Smart QR alerts for your parked car</p>
          </td>
        </tr>
        <tr>
          <td style="background:#EEF2FF;padding:24px 32px;text-align:center;border-bottom:1px solid #E5E7EB;">
            <p style="margin:0;font-size:28px;">🔒</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#111827;">Your sign-in code</p>
            <p style="margin:6px 0 0;font-size:13px;color:#6B7280;">Use this code to complete your sign-in to ParkPeace.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
              Enter the 6-digit code below in the ParkPeace sign-in screen. This code is valid for <strong>10 minutes</strong> and can only be used once.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;background:#EEF2FF;border-radius:12px;border:2px solid #4F46E5;">
              <tr>
                <td style="padding:20px 40px;text-align:center;">
                  <span style="font-size:40px;font-weight:700;color:#4F46E5;letter-spacing:12px;font-family:monospace;">${code}</span>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#FEF3C7;border-radius:8px;border-left:4px solid #F59E0B;">
              <tr><td style="padding:14px 16px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#92400E;">Security reminder</p>
                <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
                  Never share this code with anyone. ParkPeace will never ask for your code by phone or chat. If you didn't try to sign in, please change your password immediately.
                </p>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
              This code expires in 10 minutes. If it has expired, sign in again to receive a new one.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#6B7280;font-weight:500;">ParkPeace — Free forever</p>
            <p style="margin:0;font-size:11px;color:#9CA3AF;">Built on Supabase, Firebase &amp; Vercel · No subscription required</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const resendKey = Deno.env.get("RESEND_API_KEY")
    let emailSent = false

    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ParkPeace <onboarding@resend.dev>",
          to: [user.email!],
          subject: `${code} — Your ParkPeace sign-in code`,
          html: emailHtml,
        }),
      })
      if (emailRes.ok) {
        emailSent = true
      } else {
        const err = await emailRes.text()
        console.error("Resend error, falling back to SMTP:", err)
      }
    }

    if (!emailSent) {
      // Fallback: use Supabase built-in SMTP
      const smtpRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users/${user.id}/send-email`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          },
          body: JSON.stringify({
            type: "email_otp",
            subject: `${code} — Your ParkPeace sign-in code`,
            body: emailHtml,
          }),
        }
      )
      if (!smtpRes.ok) {
        console.error("SMTP fallback also failed:", await smtpRes.text())
      }
    }

    return new Response(JSON.stringify({ otpRequired: true, sent: true }), {
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
