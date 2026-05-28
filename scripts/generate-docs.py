from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus.flowables import Flowable
import datetime

# ── Colours ──────────────────────────────────────────────────────────────────
PRIMARY     = colors.HexColor("#4F46E5")
PRIMARY_LT  = colors.HexColor("#EEF2FF")
AMBER       = colors.HexColor("#92400E")
AMBER_BG    = colors.HexColor("#FFFBEB")
AMBER_BORDER= colors.HexColor("#FCD34D")
GRAY_DARK   = colors.HexColor("#111827")
GRAY_MED    = colors.HexColor("#6B7280")
GRAY_LIGHT  = colors.HexColor("#F3F4F6")
GRAY_BORDER = colors.HexColor("#E5E7EB")
RED         = colors.HexColor("#DC2626")
GREEN       = colors.HexColor("#059669")
WHITE       = colors.white

W, H = A4

# ── Styles ────────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def s(name, **kw):
    return ParagraphStyle(name, **kw)

STYLES = {
    "cover_title": s("cover_title",   fontSize=32, textColor=WHITE,        leading=40, alignment=TA_CENTER, fontName="Helvetica-Bold"),
    "cover_sub":   s("cover_sub",     fontSize=14, textColor=colors.HexColor("#C7D2FE"), leading=20, alignment=TA_CENTER),
    "cover_meta":  s("cover_meta",    fontSize=10, textColor=colors.HexColor("#A5B4FC"), leading=14, alignment=TA_CENTER),
    "h1":          s("h1",            fontSize=18, textColor=PRIMARY,       leading=24, fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=6),
    "h2":          s("h2",            fontSize=13, textColor=GRAY_DARK,     leading=18, fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=4),
    "h3":          s("h3",            fontSize=11, textColor=PRIMARY,       leading=15, fontName="Helvetica-Bold", spaceBefore=8,  spaceAfter=3),
    "body":        s("body",          fontSize=9.5,textColor=GRAY_DARK,     leading=14, spaceAfter=4),
    "body_gray":   s("body_gray",     fontSize=9,  textColor=GRAY_MED,      leading=13),
    "bullet":      s("bullet",        fontSize=9.5,textColor=GRAY_DARK,     leading=13, leftIndent=14, bulletIndent=4, spaceAfter=2),
    "code":        s("code",          fontSize=8.5,textColor=colors.HexColor("#1E293B"), leading=12, fontName="Courier",
                                      backColor=GRAY_LIGHT, leftIndent=10, rightIndent=10, borderPadding=(4,6,4,6)),
    "note":        s("note",          fontSize=8.5,textColor=AMBER,         leading=12, backColor=AMBER_BG, leftIndent=10, rightIndent=10, borderPadding=(4,6,4,6)),
    "caption":     s("caption",       fontSize=8,  textColor=GRAY_MED,      leading=11, alignment=TA_CENTER),
    "footer":      s("footer",        fontSize=7.5,textColor=GRAY_MED,      alignment=TA_CENTER),
    "toc_entry":   s("toc_entry",     fontSize=9.5,textColor=GRAY_DARK,     leading=16, leftIndent=8),
    "toc_h1":      s("toc_h1",        fontSize=10, textColor=PRIMARY,       leading=17, fontName="Helvetica-Bold"),
}

def cell(text, bold=False, header=False):
    """Return a Paragraph suitable for a table cell so text wraps correctly."""
    style = ParagraphStyle(
        "cell",
        fontSize=8.5 if not header else 8.5,
        textColor=WHITE if header else GRAY_DARK,
        leading=12,
        fontName="Helvetica-Bold" if (bold or header) else "Helvetica",
        wordWrap="CJK",
    )
    return Paragraph(str(text), style)

def hdr(text):
    return cell(text, header=True)

def P(text, style="body"):
    return Paragraph(text, STYLES[style])

def B(text):
    return Paragraph(f"• &nbsp; {text}", STYLES["bullet"])

def HR():
    return HRFlowable(width="100%", thickness=0.5, color=GRAY_BORDER, spaceAfter=6, spaceBefore=2)

def SP(h=6):
    return Spacer(1, h)

# ── Diagram helpers ────────────────────────────────────────────────────────────

class BoxArrow(Flowable):
    """Draws a horizontal row of labelled boxes connected by arrows."""
    def __init__(self, steps, width=None, box_h=28, colors_list=None):
        Flowable.__init__(self)
        self.steps = steps
        self._width = width or (W - 4*cm)
        self.box_h = box_h
        self.colors_list = colors_list or [PRIMARY]*len(steps)
        self.height = box_h + 20

    def draw(self):
        n = len(self.steps)
        arrow_w = 18
        total_arrow = arrow_w * (n - 1)
        box_w = (self._width - total_arrow) / n
        c = self.canv
        x = 0
        for i, (label, col) in enumerate(zip(self.steps, self.colors_list)):
            c.setFillColor(col)
            c.roundRect(x, 10, box_w, self.box_h, 5, fill=1, stroke=0)
            c.setFillColor(WHITE)
            c.setFont("Helvetica-Bold", 7.5)
            lines = label.split("\n")
            ty = 10 + self.box_h/2 + (len(lines)-1)*5
            for line in lines:
                c.drawCentredString(x + box_w/2, ty, line)
                ty -= 10
            if i < n - 1:
                ax = x + box_w
                ay = 10 + self.box_h/2
                c.setFillColor(GRAY_MED)
                c.setStrokeColor(GRAY_MED)
                c.setLineWidth(1)
                c.line(ax, ay, ax + arrow_w - 6, ay)
                p = c.beginPath()
                p.moveTo(ax+arrow_w-6, ay+4)
                p.lineTo(ax+arrow_w-6, ay-4)
                p.lineTo(ax+arrow_w, ay)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
            x += box_w + arrow_w

    def wrap(self, aw, ah):
        return self._width, self.height


class VertFlow(Flowable):
    """Draws a vertical flow of labelled boxes with downward arrows."""
    def __init__(self, steps, width=200, box_h=26, gap=22):
        Flowable.__init__(self)
        self.steps = steps
        self._width = width
        self.box_h = box_h
        self.gap = gap
        self.height = len(steps) * (box_h + gap) - gap + 10

    def draw(self):
        c = self.canv
        y = self.height - self.box_h - 5
        for i, (label, col) in enumerate(self.steps):
            c.setFillColor(col)
            c.roundRect((self._width - 160)/2, y, 160, self.box_h, 5, fill=1, stroke=0)
            c.setFillColor(WHITE)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(self._width/2, y + self.box_h/2 - 4, label)
            if i < len(self.steps) - 1:
                ax = self._width/2
                ay = y
                c.setStrokeColor(GRAY_MED)
                c.setFillColor(GRAY_MED)
                c.setLineWidth(1)
                c.line(ax, ay, ax, ay - self.gap + 6)
                p = c.beginPath()
                p.moveTo(ax-4, ay-self.gap+6)
                p.lineTo(ax+4, ay-self.gap+6)
                p.lineTo(ax, ay-self.gap)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
            y -= (self.box_h + self.gap)

    def wrap(self, aw, ah):
        return self._width, self.height


class TwoColFlow(Flowable):
    """Side-by-side vertical flows."""
    def __init__(self, left_steps, right_steps, width=None, box_h=24, gap=20):
        Flowable.__init__(self)
        self._width = width or (W - 4*cm)
        self.left = left_steps
        self.right = right_steps
        self.box_h = box_h
        self.gap = gap
        rows = max(len(left_steps), len(right_steps))
        self._inner_height = rows * (box_h + gap)
        self.height = self._inner_height + 36  # 36 = 20 header + 16 top pad

    def _draw_col(self, c, steps, cx, col_w):
        y = self._inner_height - self.box_h + 6
        for i, (label, col) in enumerate(steps):
            if not label:
                y -= (self.box_h + self.gap)
                continue
            c.setFillColor(col)
            c.roundRect(cx, y, col_w, self.box_h, 5, fill=1, stroke=0)
            c.setFillColor(WHITE)
            c.setFont("Helvetica-Bold", 7.5)
            lines = label.split("\n")
            ty = y + self.box_h/2 + (len(lines)-1)*4.5
            for line in lines:
                c.drawCentredString(cx + col_w/2, ty, line)
                ty -= 9
            if i < len(steps) - 1 and steps[i+1][0]:
                ax = cx + col_w/2
                ay = y
                c.setStrokeColor(GRAY_MED)
                c.setFillColor(GRAY_MED)
                c.setLineWidth(0.8)
                c.line(ax, ay, ax, ay - self.gap + 5)
                p = c.beginPath()
                p.moveTo(ax-3, ay-self.gap+5)
                p.lineTo(ax+3, ay-self.gap+5)
                p.lineTo(ax, ay-self.gap)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
            y -= (self.box_h + self.gap)

    def draw(self):
        c = self.canv
        col_w = (self._width - 20) / 2
        header_y = self._inner_height + 14
        # Header backgrounds
        c.setFillColor(PRIMARY_LT)
        c.roundRect(0, header_y, col_w, 16, 3, fill=1, stroke=0)
        c.roundRect(col_w + 20, header_y, col_w, 16, 3, fill=1, stroke=0)
        c.setFillColor(PRIMARY)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(col_w/2, header_y + 4, "Scanner (anonymous)")
        c.drawCentredString(col_w + 20 + col_w/2, header_y + 4, "Owner (authenticated)")
        self._draw_col(c, self.left, 0, col_w)
        self._draw_col(c, self.right, col_w + 20, col_w)

    def wrap(self, aw, ah):
        return self._width, self.height


# ── Page template ─────────────────────────────────────────────────────────────

def make_doc(path):
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2.2*cm,
        bottomMargin=2.2*cm,
        title="ParkPeace — Product Documentation",
        author="ParkPeace",
        subject="Product Documentation",
        creator="ParkPeace Docs Generator",
        encrypt=None,
    )
    return doc

def add_header_footer(canvas, doc):
    canvas.saveState()
    # Header rule (skip cover)
    if doc.page > 1:
        canvas.setStrokeColor(GRAY_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(2*cm, H - 1.6*cm, W - 2*cm, H - 1.6*cm)
        canvas.setFillColor(GRAY_MED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(2*cm, H - 1.4*cm, "ParkPeace — Product Documentation")
        canvas.drawRightString(W - 2*cm, H - 1.4*cm, f"Page {doc.page}")
    # Footer
    canvas.setStrokeColor(GRAY_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, 1.5*cm, W - 2*cm, 1.5*cm)
    canvas.setFillColor(GRAY_MED)
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(W/2, 1*cm, f"Confidential · Generated {datetime.datetime.now().strftime('%B %d, %Y')} · ParkPeace")
    canvas.restoreState()


# ── Cover page ────────────────────────────────────────────────────────────────



def build_cover():
    elems = []
    elems.append(SP(80))

    # Single table renders the entire cover block — background + text in one pass
    cover_data = [
        [Paragraph("ParkPeace", STYLES["cover_title"])],
        [SP(4)],
        [Paragraph("Product Documentation", STYLES["cover_sub"])],
        [SP(8)],
        [Paragraph("Architecture · Flows · Tech Stack · Features · Security", STYLES["cover_meta"])],
        [SP(4)],
        [Paragraph(f"Version 1.0 &nbsp;·&nbsp; {datetime.datetime.now().strftime('%B %Y')}", STYLES["cover_meta"])],
        [SP(10)],
    ]
    cover_table = Table(cover_data, colWidths=[W - 4*cm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), PRIMARY),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 20),
        ("RIGHTPADDING",  (0,0), (-1,-1), 20),
        ("ROUNDEDCORNERS", [12]),
    ]))
    elems.append(cover_table)
    elems.append(SP(40))
    elems.append(P("Confidential — Internal Reference", "body_gray"))
    elems.append(PageBreak())
    return elems


# ── TOC ───────────────────────────────────────────────────────────────────────

def build_toc():
    elems = []
    elems.append(P("Table of Contents", "h1"))
    elems.append(HR())
    toc = [
        ("1. Product Overview", None),
        ("2. Architecture Overview", None),
        ("3. User Flows", None),
        ("    3.1  Owner Onboarding Flow", True),
        ("    3.2  Scanner Contact Flow", True),
        ("    3.3  Scanner Emergency Flow", True),
        ("    3.4  Live Chat Flow", True),
        ("4. Tech Stack", None),
        ("5. Database Schema", None),
        ("6. Edge Functions", None),
        ("    6.1  notify-owner", True),
        ("    6.2  chat-notify", True),
        ("7. Push Notification Architecture", None),
        ("8. Security Model", None),
        ("9. Feature Reference", None),
        ("10. iOS / iPhone Limitations", None),
        ("11. Deployment & CI/CD", None),
        ("12. Cost Summary", None),
    ]
    for label, sub in toc:
        style = "toc_entry" if sub else "toc_h1"
        elems.append(P(label, style))
    elems.append(PageBreak())
    return elems


# ── Sections ──────────────────────────────────────────────────────────────────

def section_overview():
    elems = []
    elems.append(P("1. Product Overview", "h1"))
    elems.append(HR())
    elems.append(P(
        "ParkPeace is a free progressive web app that lets car owners place a printed QR code on their "
        "parked vehicle. Anyone who needs to reach the owner — to report a blocked driveway, a light left on, "
        "or an emergency — simply scans the QR with any phone camera. No app download or account is required "
        "on the scanner's side.",
    ))
    elems.append(SP(4))
    elems.append(P("Key value propositions:", "h3"))
    for b in [
        "Instant push notification to the owner on every scan",
        "Owner's phone number is <b>never</b> exposed to the scanner",
        "Works on any device — no app install needed for the scanner",
        "Real-time live chat between scanner and owner after every contact",
        "Emergency flow: push alert to owner + scanner's phone dials the emergency contact",
        "100% free — Supabase, Firebase, and Vercel free tiers, no credit card required",
    ]:
        elems.append(B(b))
    elems.append(SP(8))
    elems.append(P("Target users:", "h3"))
    data = [
        [hdr("Role"), hdr("Description"), hdr("Authentication")],
        [cell("Owner"), cell("Car owner who registers, sets up profile, places QR on vehicle"), cell("Required (Supabase Auth)")],
        [cell("Scanner"), cell("Anyone who scans the QR to reach the owner"), cell("None — fully anonymous")],
    ]
    t = Table(data, colWidths=[3.5*cm, 8*cm, 5.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
        ("ROUNDEDCORNERS",[4]),
    ]))
    elems.append(t)
    elems.append(PageBreak())
    return elems


def section_architecture():
    elems = []
    elems.append(P("2. Architecture Overview", "h1"))
    elems.append(HR())
    elems.append(P(
        "ParkPeace follows a serverless architecture. The React frontend communicates directly with Supabase "
        "(database + auth + realtime) and calls Supabase Edge Functions for operations that require a "
        "service-role key (owner lookup, FCM push delivery). Firebase handles push notification delivery "
        "via a service worker registered in the browser."
    ))
    elems.append(SP(12))

    # High-level component diagram
    elems.append(P("High-Level Components", "h2"))
    layers = [
        ("Browser\n(React PWA)", PRIMARY),
        ("Supabase\nEdge Functions", colors.HexColor("#7C3AED")),
        ("Supabase\nDB + Auth", colors.HexColor("#0284C7")),
        ("Firebase\nFCM", colors.HexColor("#D97706")),
        ("Vercel\nHosting", colors.HexColor("#059669")),
    ]
    elems.append(BoxArrow([l for l,_ in layers], colors_list=[c for _,c in layers]))
    elems.append(SP(4))
    elems.append(P("Data flows left-to-right: browser calls Edge Functions; Edge Functions query DB and push via FCM; Vercel hosts the static build.", "caption"))
    elems.append(SP(14))

    # Layers table
    elems.append(P("Layer Responsibilities", "h2"))
    data = [
        ["Layer", "Service", "Responsibility"],
        ["Frontend",    "React + Vite + Tailwind",  "UI, auth state, realtime chat subscription, FCM token registration"],
        ["Auth & DB",   "Supabase (PostgreSQL)",     "User auth, RLS-protected tables, realtime publish/subscribe"],
        ["Edge Logic",  "Supabase Edge Functions\n(Deno)", "Owner lookup, scan event logging, FCM JWT signing, push delivery"],
        ["Push",        "Firebase Cloud Messaging",  "Delivers push to owner device and optionally to scanner"],
        ["Service Worker","firebase-messaging-sw.js","Background push handling, notification display, notification click routing"],
        ["Hosting",     "Vercel",                    "Static site hosting, auto-deploy from GitHub, env var management"],
        ["CI/CD",       "GitHub Actions",            "Deploys Edge Functions on push to main when supabase/functions/** changes"],
    ]
    t = Table(data, colWidths=[3.2*cm, 4.2*cm, 9.6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
    ]))
    elems.append(t)
    elems.append(PageBreak())
    return elems


def section_flows():
    elems = []
    elems.append(P("3. User Flows", "h1"))
    elems.append(HR())

    # 3.1 Owner onboarding
    elems.append(P("3.1  Owner Onboarding Flow", "h2"))
    steps = [
        ("Register\n(email+pw)", PRIMARY),
        ("Sign In", PRIMARY),
        ("Complete\nProfile", colors.HexColor("#7C3AED")),
        ("Enable Push\nNotifications", colors.HexColor("#D97706")),
        ("Add Vehicle\n(QR generated)", colors.HexColor("#0284C7")),
        ("Print &\nPlace QR", GREEN),
    ]
    elems.append(BoxArrow([s for s,_ in steps], colors_list=[c for _,c in steps]))
    elems.append(SP(6))
    for b in [
        "New users are redirected to Profile on first login — enforced once via <i>localStorage</i> flag",
        "Profile stores: full name, phone, WhatsApp number, emergency name/phone/relationship",
        "Push notification token (FCM) is saved to <b>profiles.fcm_token</b> on permission grant",
        "Each vehicle generates a unique UUID-based QR pointing to <b>/scan/:qrId</b>",
        "QR can be downloaded as a PNG and printed",
    ]:
        elems.append(B(b))
    elems.append(SP(14))

    # 3.2 Scanner Contact
    elems.append(P("3.2  Scanner Contact Flow", "h2"))
    left = [
        ("Scan QR →\n/scan/:qrId", PRIMARY),
        ("Fill Contact\nForm", PRIMARY),
        ("Tap Notify\nOwner", PRIMARY),
        ("Chat window\nopens", colors.HexColor("#7C3AED")),
        ("Opt in for\nreply alerts", colors.HexColor("#D97706")),
    ]
    right = [
        ("Push notification\nreceived", colors.HexColor("#D97706")),
        ("Tap notification →\n/chat/:sessionId", PRIMARY),
        ("Reply in\nchat", PRIMARY),
        ("Scanner gets\npush alert", colors.HexColor("#D97706")),
        ("", colors.HexColor("#E5E7EB")),
    ]
    elems.append(TwoColFlow(left, right))
    elems.append(SP(6))
    for b in [
        "Scanner's phone and WhatsApp number are <b>never</b> shown — Edge Function returns WhatsApp only after notification is sent",
        "Chat session created server-side; <b>chatSessionId</b> returned in HTTP response",
        "Chat session UUID stored in <i>sessionStorage</i> so scanner can reload and rejoin",
        "WhatsApp pre-filled message opened in new tab simultaneously (if owner has WhatsApp configured)",
        "Scanner push opt-in: FCM token saved to <b>chat_sessions.scanner_fcm_token</b>",
    ]:
        elems.append(B(b))
    elems.append(SP(14))

    # 3.3 Emergency
    elems.append(P("3.3  Scanner Emergency Flow", "h2"))
    steps = [
        ("Fill Emergency\nForm", RED),
        ("POST to\nnotify-owner", RED),
        ("Edge Fn logs\nscan_event", colors.HexColor("#7C3AED")),
        ("FCM push\nto owner", colors.HexColor("#D97706")),
        ("Scanner phone\ndials emergency\ncontact (tel:)", RED),
    ]
    elems.append(BoxArrow([s for s,_ in steps], colors_list=[c for _,c in steps]))
    elems.append(SP(6))
    for b in [
        "No server cost for the call — scanner's own phone plan is used",
        "Emergency contact phone returned from Edge Function, sanitised (digits + '+' only)",
        "Owner push alert sent regardless of whether emergency contact is reached",
        "No chat session created for emergency actions",
    ]:
        elems.append(B(b))
    elems.append(SP(14))

    # 3.4 Chat flow
    elems.append(P("3.4  Live Chat Flow", "h2"))
    steps = [
        ("contact action\nsubmitted", PRIMARY),
        ("chat_sessions\nrow created", colors.HexColor("#0284C7")),
        ("chatSessionId\nreturned", colors.HexColor("#0284C7")),
        ("Both sides\nsubscribe\n(Realtime WS)", colors.HexColor("#7C3AED")),
        ("Message\ninserted", PRIMARY),
        ("chat-notify\nEdge Fn fires", colors.HexColor("#D97706")),
        ("FCM push\nto other party", colors.HexColor("#D97706")),
    ]
    elems.append(BoxArrow([s for s,_ in steps], colors_list=[c for _,c in steps]))
    elems.append(SP(6))
    for b in [
        "Realtime subscription filtered by <b>session_id=eq.{sessionId}</b> — each side only receives its session's messages",
        "Optimistic UI: message shown immediately with a local UUID; replaced by real row on Realtime delivery",
        "On mobile tab return (<i>visibilitychange</i>), messages are re-fetched to recover from suspension",
        "Session expires after 24 hours — pg_cron deletes expired rows; cascade removes messages",
        "Scan history row preserved via <b>ON DELETE SET NULL</b> on <b>scan_events.chat_session_id</b>",
    ]:
        elems.append(B(b))
    elems.append(PageBreak())
    return elems


def section_techstack():
    elems = []
    elems.append(P("4. Tech Stack", "h1"))
    elems.append(HR())
    data = [
        ["Category",          "Technology",                     "Version / Tier",    "Purpose"],
        ["Frontend Framework","React + TypeScript + Vite",      "React 18",          "UI, routing, state management"],
        ["Styling",           "Tailwind CSS",                   "v3",                "Utility-first CSS"],
        ["Routing",           "React Router",                   "v6",                "Client-side routing, protected routes"],
        ["Icons",             "Lucide React",                   "latest",            "UI icons"],
        ["QR Generation",     "qrcode.react",                   "v3",                "Client-side QR code rendering"],
        ["Auth & Database",   "Supabase",                       "Free tier",         "PostgreSQL, RLS, Auth, Realtime, Edge Functions"],
        ["Realtime",          "Supabase Realtime",              "postgres_changes",  "Live chat message delivery via WebSocket"],
        ["Edge Functions",    "Deno (Supabase)",                "Free — 500K/month", "notify-owner, chat-notify serverless handlers"],
        ["Push Notifications","Firebase Cloud Messaging (FCM)", "v1 API",            "Push delivery to owner and scanner devices"],
        ["Service Worker",    "firebase-messaging-sw.js",       "FCM compat SDK 10", "Background push, notification click routing"],
        ["Hosting",           "Vercel",                         "Free tier",         "Static hosting, auto-deploy from GitHub"],
        ["CI/CD",             "GitHub Actions",                 "—",                 "Edge Function deployment on push"],
        ["Scheduled Jobs",    "pg_cron (Supabase)",             "Extension",         "Deletes expired chat sessions every 10 minutes"],
        ["PDF Docs",          "ReportLab",                      "Python",            "Generates this document at release time"],
    ]
    t = Table(data, colWidths=[3.6*cm, 4.2*cm, 3.2*cm, 6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
    ]))
    elems.append(t)
    elems.append(PageBreak())
    return elems


def section_schema():
    elems = []
    elems.append(P("5. Database Schema", "h1"))
    elems.append(HR())
    elems.append(P(
        "All tables reside in the Supabase PostgreSQL instance. Row Level Security (RLS) is enabled on every table. "
        "The Edge Functions use the service-role key to bypass RLS for cross-table lookups."
    ))
    elems.append(SP(8))

    tables = [
        ("profiles", "auth.users FK (id)", [
            ("id",                "uuid",         "PK, FK → auth.users"),
            ("full_name",         "text",         "Owner's display name"),
            ("phone",             "text",         "Owner's phone (never exposed to scanner)"),
            ("whatsapp_number",   "text",         "Optional — used for pre-filled WhatsApp link"),
            ("emergency_name",    "text",         "Emergency contact name"),
            ("emergency_phone",   "text",         "Emergency contact phone (returned to scanner on emergency)"),
            ("emergency_rel",     "text",         "Relationship to emergency contact"),
            ("fcm_token",         "text",         "Firebase push token — updated on each login/permission grant"),
            ("updated_at",        "timestamptz",  "Last profile update"),
        ]),
        ("qr_codes", "one per vehicle", [
            ("id",         "uuid",        "PK — encoded in QR URL"),
            ("user_id",    "uuid",        "FK → auth.users"),
            ("name",       "text",        "Vehicle label (e.g. 'Red Swift')"),
            ("created_at", "timestamptz", ""),
        ]),
        ("scan_events", "immutable audit log", [
            ("id",              "uuid",        "PK"),
            ("qr_code_id",      "uuid",        "FK → qr_codes"),
            ("action",          "text",        "'contact' | 'emergency'"),
            ("scanner_name",    "text",        ""),
            ("scanner_phone",   "text",        ""),
            ("scanner_note",    "text",        ""),
            ("chat_session_id", "uuid",        "FK → chat_sessions ON DELETE SET NULL — preserved after chat expires"),
            ("scanned_at",      "timestamptz", ""),
        ]),
        ("chat_sessions", "ephemeral — deleted after 24h", [
            ("id",                "uuid",        "PK — acts as scanner's credential"),
            ("qr_code_id",        "uuid",        "FK → qr_codes"),
            ("owner_id",          "uuid",        "FK → auth.users"),
            ("scanner_name",      "text",        ""),
            ("scanner_phone",     "text",        ""),
            ("scanner_fcm_token", "text",        "Optional — stored when scanner opts in for push"),
            ("expires_at",        "timestamptz", "Default: now() + 24h"),
            ("created_at",        "timestamptz", ""),
        ]),
        ("chat_messages", "cascade-deleted with session", [
            ("id",          "uuid",        "PK"),
            ("session_id",  "uuid",        "FK → chat_sessions ON DELETE CASCADE"),
            ("sender_role", "text",        "CHECK IN ('scanner', 'owner')"),
            ("body",        "text",        "CHECK char_length ≤ 2000"),
            ("created_at",  "timestamptz", ""),
        ]),
    ]

    for tname, note, cols in tables:
        elems.append(KeepTogether([
            P(f"{tname} <font color='#6B7280' size='8'>— {note}</font>", "h3"),
        ]))
        data = [["Column", "Type", "Notes"]] + [[c,t,n] for c,t,n in cols]
        t = Table(data, colWidths=[4.5*cm, 2.8*cm, 9.7*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  PRIMARY_LT),
            ("TEXTCOLOR",     (0,0), (-1,0),  PRIMARY),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,-1), 8),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
            ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 7),
        ]))
        elems.append(t)
        elems.append(SP(8))

    # RLS summary
    elems.append(P("RLS Policy Summary", "h2"))
    data = [
        ["Table",           "Who can SELECT",                        "Who can INSERT",                    "Who can UPDATE/DELETE"],
        ["profiles",        "Owner (own row only)",                  "Owner (own row only)",               "Owner (own row only)"],
        ["qr_codes",        "Anyone (public read for scan page)\nOwner (full access)",
                                                                     "Owner",                              "Owner"],
        ["scan_events",     "Owner (via qr_code ownership)",         "Edge Function (service-role)",       "—"],
        ["chat_sessions",   "Owner (own sessions)\nScanner (anon, UUID-gated, not expired)",
                                                                     "Edge Function (service-role)",       "Scanner (anon — to save FCM token)"],
        ["chat_messages",   "Owner (own sessions)\nScanner (anon, not expired)",
                                                                     "Owner (role='owner')\nScanner (role='scanner', anon)", "—"],
    ]
    t = Table(data, colWidths=[3*cm, 5*cm, 4*cm, 5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 7.5),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
    ]))
    elems.append(t)
    elems.append(PageBreak())
    return elems


def section_edge_functions():
    elems = []
    elems.append(P("6. Edge Functions", "h1"))
    elems.append(HR())
    elems.append(P(
        "Edge Functions run on Deno (Supabase). They use the service-role key to bypass RLS "
        "and the Firebase service account JSON to sign FCM JWTs. Both functions are deployed "
        "via GitHub Actions with <b>--no-verify-jwt</b> so the anon key in the frontend is sufficient."
    ))
    elems.append(SP(8))

    elems.append(P("6.1  notify-owner", "h2"))
    data = [
        ["Field",    "Value"],
        ["Endpoint", "POST /functions/v1/notify-owner"],
        ["Auth",     "Supabase anon key in Authorization header"],
        ["Input",    "{ qrCodeId, scannerName, scannerPhone?, note, action: 'contact'|'emergency' }"],
        ["Output (contact)",  "{ success, chatSessionId?, whatsappNumber?, carName? }"],
        ["Output (emergency)","{ success, emergencyPhone? }"],
    ]
    t = Table(data, colWidths=[3.5*cm, 13.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (0,-1),  GRAY_LIGHT),
        ("FONTNAME",      (0,0), (0,-1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8.5),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
    ]))
    elems.append(t)
    elems.append(SP(6))
    elems.append(P("Execution order:", "h3"))
    steps = [
        ("Validate\ninput", PRIMARY),
        ("Fetch qr_code\n+ profile", colors.HexColor("#0284C7")),
        ("Insert\nchat_sessions\n(contact only)", colors.HexColor("#7C3AED")),
        ("Insert\nscan_events", colors.HexColor("#7C3AED")),
        ("Sign FCM\nJWT (RS256)", colors.HexColor("#D97706")),
        ("POST to\nFCM v1 API", colors.HexColor("#D97706")),
        ("Return\nresponse", GREEN),
    ]
    elems.append(BoxArrow([s for s,_ in steps], colors_list=[c for _,c in steps]))
    elems.append(SP(4))
    for b in [
        "Server-side input limits: scannerName ≤ 100, note ≤ 1000, scannerPhone ≤ 20 characters",
        "Phone numbers sanitised before returning to client: <b>/[^\\d+]/g</b> stripped",
        "<b>APP_ORIGIN</b> env var used to build the chatUrl passed in FCM data payload",
        "FCM errors are caught and logged — they do not fail the HTTP response",
    ]:
        elems.append(B(b))
    elems.append(SP(14))

    elems.append(P("6.2  chat-notify", "h2"))
    data = [
        ["Field",   "Value"],
        ["Endpoint","POST /functions/v1/chat-notify"],
        ["Auth",    "Supabase anon key in Authorization header"],
        ["Input",   "{ sessionId, senderRole: 'scanner'|'owner', body }"],
        ["Output",  "{ success: true }"],
    ]
    t = Table(data, colWidths=[3.5*cm, 13.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (0,-1),  GRAY_LIGHT),
        ("FONTNAME",      (0,0), (0,-1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8.5),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
    ]))
    elems.append(t)
    elems.append(SP(6))
    for b in [
        "Called fire-and-forget from <b>ChatWindow</b> after every successful message insert",
        "If <b>senderRole = 'scanner'</b>: pushes to owner's <b>profiles.fcm_token</b>",
        "If <b>senderRole = 'owner'</b>: pushes to <b>chat_sessions.scanner_fcm_token</b> (if set)",
        "Push body truncated to 60 chars with ellipsis for notification preview",
        "Returns 410 Gone if session has expired — client ignores this silently",
    ]:
        elems.append(B(b))
    elems.append(PageBreak())
    return elems


def section_push():
    elems = []
    elems.append(P("7. Push Notification Architecture", "h1"))
    elems.append(HR())
    elems.append(SP(6))

    steps = [
        ("Edge Function\nbuilds JWT\n(RS256)", colors.HexColor("#7C3AED")),
        ("Exchange JWT\nfor OAuth2\naccess token", colors.HexColor("#D97706")),
        ("POST to\nFCM v1 API\nwith token", colors.HexColor("#D97706")),
        ("FCM delivers\nto device via\nAPNs / GCM", colors.HexColor("#0284C7")),
        ("Service Worker\nor foreground\nhandler fires", PRIMARY),
    ]
    elems.append(BoxArrow([s for s,_ in steps], colors_list=[c for _,c in steps]))
    elems.append(SP(10))

    elems.append(P("Foreground vs Background", "h2"))
    data = [
        ["State",               "Handler",                        "Behaviour"],
        ["App in foreground",   "Firebase onMessage (main thread)","Notification shown via custom toast; badge API called"],
        ["App in background\nor closed", "firebase-messaging-sw.js (service worker)", "showNotification() called with title, body, icon, data.chatUrl"],
        ["Notification click",  "notificationclick event (SW)",   "Focuses existing window or opens clients.openWindow(chatUrl)"],
    ]
    t = Table(data, colWidths=[4*cm, 5.5*cm, 7.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8.5),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
    ]))
    elems.append(t)
    elems.append(SP(10))

    elems.append(P("FCM Token Lifecycle", "h2"))
    for b in [
        "Owner: token fetched via <b>getToken(messaging, { vapidKey, serviceWorkerRegistration })</b> and saved to <b>profiles.fcm_token</b>",
        "Scanner: token fetched on opt-in tap and saved to <b>chat_sessions.scanner_fcm_token</b>",
        "Service worker generated at build time from env vars by <b>scripts/generate-sw.js</b> — no API keys committed to git",
        "Each browser/device has its own token — enabling on mobile does not affect desktop and vice versa",
    ]:
        elems.append(B(b))
    elems.append(PageBreak())
    return elems


def section_security():
    elems = []
    elems.append(P("8. Security Model", "h1"))
    elems.append(HR())

    items = [
        ("Phone number privacy",
         "The owner's phone and WhatsApp number are never sent in the initial page load. "
         "They are returned by the Edge Function only after the scan event is logged, and only to enable "
         "the WhatsApp deep link on the scanner's own device."),
        ("RLS enforcement",
         "Every table has Row Level Security enabled. Owners can only read and modify their own rows. "
         "The Edge Functions use the service-role key to perform cross-user lookups (e.g. fetching the "
         "owner profile from a public QR scan)."),
        ("Scanner credential",
         "Scanners are anonymous. The chat session UUID (122-bit entropy from gen_random_uuid()) "
         "acts as their credential — only someone who knows it can read or write to that session. "
         "No login, no token, no cookie required."),
        ("Input validation",
         "Server-side length limits are enforced in each Edge Function (scannerName ≤ 100, note ≤ 1000, "
         "phone ≤ 20 characters). Client-side limits mirror these but are not trusted as a security boundary."),
        ("CORS",
         "Edge Functions use Access-Control-Allow-Origin: * because the Supabase anon key is already "
         "public. Restricting to a specific origin with a dynamic function was attempted but caused "
         "production failures when the APP_ORIGIN env var was absent. Wildcard is appropriate here."),
        ("Open redirect prevention",
         "The ?next= redirect param after login is validated to start with '/' and not '//' before navigation, "
         "preventing open redirect attacks."),
        ("Service worker & env vars",
         "The Firebase service worker is generated at build time by a Node script that reads env vars. "
         "Firebase config is embedded in the built SW file on Vercel — no secrets are committed to git."),
        ("Chat expiry",
         "Chat sessions and messages are deleted after 24 hours by pg_cron. Scanner FCM tokens are "
         "deleted with the session. Scan history rows are preserved via ON DELETE SET NULL."),
    ]

    for title, body in items:
        elems.append(KeepTogether([
            P(f"<b>{title}</b>", "h3"),
            P(body),
            SP(4),
        ]))

    elems.append(PageBreak())
    return elems


def section_features():
    elems = []
    elems.append(P("9. Feature Reference", "h1"))
    elems.append(HR())

    features = [
        ("Owner Dashboard", [
            "Profile tab: view/edit full name, phone, WhatsApp, emergency contact",
            "My Vehicles tab: add, rename, delete vehicles; download QR as PNG",
            "Scan History tab: all events with scanner name, phone, note, timestamp, action",
            "Per-vehicle history popup via clock icon on each vehicle card",
            "Clear History: delete events by custom date range",
            "Unread badge on Scan History tab + Web Badge API on app icon",
            "Push notification enable/disable in Profile",
        ]),
        ("Scanner Page (/scan/:qrId)", [
            "Public — no login required",
            "Contact Owner form: name (required), phone (required, 10 digits), message (required)",
            "Emergency form: name + description; triggers push + tel: dialer on scanner's phone",
            "Live chat window opens inline after contact form submission",
            "\"Get notified when owner replies\" opt-in button (FCM token saved to chat session)",
            "Chat session persisted in sessionStorage — scanner can reload and rejoin",
        ]),
        ("Live Chat", [
            "24-hour ephemeral sessions — auto-deleted by pg_cron every 10 minutes",
            "Real-time delivery via Supabase Realtime postgres_changes",
            "Optimistic UI with deduplication on Realtime delivery",
            "Expiry countdown in chat header; input disabled on expiry",
            "Owner joins via push notification tap or Scan History 'Open Chat' link",
            "Scanner joins via inline chat on /scan/:qrId page",
            "Messages re-fetched on visibilitychange for mobile background recovery",
        ]),
        ("Push Notifications", [
            "FCM v1 API — JWT signed with RSA/RS256 in Edge Function (no third-party library)",
            "Owner notified on every scan (contact and emergency)",
            "Owner notified on every chat message from scanner",
            "Scanner optionally notified on owner replies",
            "Notification click opens chatUrl or falls back to home",
            "App icon badge set via Web Badge API",
        ]),
        ("Authentication & Accounts", [
            "Supabase Auth: email + password",
            "Confirm password field with live match indicator on register",
            "Eye icon to show/hide password",
            "Forgot password via email reset link",
            "Reset password page with token from Supabase PASSWORD_RECOVERY event",
            "First-login redirect to Profile (enforced once via localStorage flag)",
        ]),
        ("WhatsApp Integration", [
            "Owner's WhatsApp number saved in profile (optional)",
            "Pre-filled message includes scanner name, number, and message",
            "New tab opened synchronously on submit (before async fetch) to avoid popup blocking",
            "Tab navigated to wa.me URL after server confirms owner has WhatsApp; closed otherwise",
        ]),
    ]

    for group, items in features:
        elems.append(P(group, "h2"))
        for item in items:
            elems.append(B(item))
        elems.append(SP(6))

    elems.append(PageBreak())
    return elems


def section_ios():
    elems = []
    elems.append(P("10. iOS / iPhone Limitations", "h1"))
    elems.append(HR())
    elems.append(P(
        "Apple restricts push notifications on iOS to apps installed to the Home Screen (PWA). "
        "This is an Apple platform limitation, not a ParkPeace limitation. The following table "
        "summarises the behaviour per platform and context."
    ))
    elems.append(SP(8))
    data = [
        ["Platform",             "Browser",       "Push Notifications",  "Notes"],
        ["Android",              "Chrome",         "✓ Full support",      "Works in-browser, no install needed"],
        ["Android",              "Samsung Internet","✓ Full support",     "Works in-browser"],
        ["iPhone / iPad (iOS 16.4+)", "Safari",    "✓ With Home Screen", "Must add to Home Screen first via Share → Add to Home Screen"],
        ["iPhone / iPad (iOS 16.4+)", "Chrome/Edge","✗ Not supported",   "Apple restricts push to Safari PWAs on iOS"],
        ["iPhone (iOS < 16.4)",  "Any",            "✗ Not supported",    "iOS 16.4 introduced Web Push support"],
        ["Mac",                  "Chrome / Edge",  "✓ Full support",     "May need System Settings → Notifications → Chrome → Allow"],
        ["Windows",              "Chrome / Edge",  "✓ Full support",     "May need Settings → Notifications → Chrome → On"],
    ]
    t = Table(data, colWidths=[4.5*cm, 3*cm, 3.5*cm, 6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
    ]))
    elems.append(t)
    elems.append(SP(10))

    elems.append(P("iPhone Home Screen Setup (iOS 16.4+)", "h2"))
    for b in [
        "Open the ParkPeace URL in <b>Safari</b> (not Chrome — Apple only allows push from Safari PWAs)",
        "Tap the <b>Share</b> button at the bottom of the screen (box with arrow pointing up)",
        "Scroll down and tap <b>Add to Home Screen</b>",
        "Tap <b>Add</b> in the top-right corner",
        "Open the app from the Home Screen icon",
        "Go to Profile → tap <b>Enable</b> in Push Notifications → allow when prompted",
    ]:
        elems.append(B(b))
    elems.append(SP(8))

    elems.append(Paragraph(
        "<b>Note for scanners on iPhone:</b> The \"Get notified when owner replies\" button on the scan page "
        "will show an error on iPhone if the page has not been added to the Home Screen. The error message "
        "explicitly states this is an Apple limitation, not a ParkPeace issue.",
        STYLES["note"]
    ))
    elems.append(PageBreak())
    return elems


def section_deployment():
    elems = []
    elems.append(P("11. Deployment & CI/CD", "h1"))
    elems.append(HR())

    elems.append(P("Frontend (Vercel)", "h2"))
    for b in [
        "Connected to GitHub repository — every push to <b>main</b> triggers an auto-deploy",
        "Build command: <b>node scripts/generate-sw.js &amp;&amp; vite build</b> — generates service worker before bundling",
    ]:
        elems.append(B(b))
    elems.append(P("Required Vercel environment variables:", "h3"))
    env_vars = [
        ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_FIREBASE_API_KEY"],
        ["VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_STORAGE_BUCKET"],
        ["VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_APP_ID", "VITE_FIREBASE_VAPID_KEY"],
    ]
    for row in env_vars:
        t = Table([row], colWidths=[(W - 4*cm)/3]*3)
        t.setStyle(TableStyle([
            ("FONTNAME",      (0,0), (-1,-1), "Courier"),
            ("FONTSIZE",      (0,0), (-1,-1), 7.5),
            ("BACKGROUND",    (0,0), (-1,-1), GRAY_LIGHT),
            ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ]))
        elems.append(t)
    elems.append(SP(8))

    elems.append(P("Edge Functions (GitHub Actions)", "h2"))
    for b in [
        "Workflow: <b>.github/workflows/deploy-functions.yml</b>",
        "Triggers on push to <b>main</b> when files under <b>supabase/functions/**</b> change",
        "Deploys <b>notify-owner</b> and <b>chat-notify</b> with <b>--no-verify-jwt</b>",
        "Required GitHub secrets: <b>SUPABASE_PROJECT_ID</b>, <b>SUPABASE_ACCESS_TOKEN</b>",
    ]:
        elems.append(B(b))
    elems.append(SP(8))

    elems.append(P("Edge Function Secrets (Supabase Dashboard)", "h2"))
    data = [
        [hdr("Secret"), hdr("Used by"), hdr("Description")],
        [cell("SUPABASE_URL"),                 cell("Both functions"), cell("Auto-provided by Supabase runtime")],
        [cell("SUPABASE_SERVICE_ROLE_KEY"),    cell("Both functions"), cell("Auto-provided by Supabase runtime")],
        [cell("FIREBASE_SERVICE_ACCOUNT_JSON"),cell("notify-owner, chat-notify"), cell("Full Firebase service account JSON for FCM JWT signing")],
        [cell("APP_ORIGIN"),                   cell("notify-owner, chat-notify"), cell("Frontend URL (e.g. https://parkpeace.vercel.app) — used to build chatUrl in FCM data payload")],
    ]
    t = Table(data, colWidths=[4.8*cm, 3.8*cm, 8.4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
    ]))
    elems.append(t)
    elems.append(SP(8))

    elems.append(P("Database Migrations", "h2"))
    data = [
        ["File",                          "Description"],
        ["001_initial.sql",               "profiles, qr_codes, scan_events — base schema + RLS"],
        ["002_whatsapp.sql",              "Adds whatsapp_number to profiles"],
        ["003_fcm.sql",                   "Adds fcm_token to profiles; removes onesignal_player_id"],
        ["004_chat.sql",                  "chat_sessions, chat_messages — RLS, Realtime publication"],
        ["005_scan_event_chat_link.sql",  "Adds chat_session_id FK (ON DELETE SET NULL) to scan_events"],
        ["006_chat_scanner_token.sql",    "Adds scanner_fcm_token to chat_sessions + RLS UPDATE policy"],
    ]
    t = Table(data, colWidths=[6.5*cm, 10.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY_LT),
        ("TEXTCOLOR",     (0,0), (-1,0),  PRIMARY),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8.5),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [WHITE, GRAY_LIGHT]),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
    ]))
    elems.append(t)
    elems.append(PageBreak())
    return elems


def section_cost():
    elems = []
    elems.append(P("12. Cost Summary", "h1"))
    elems.append(HR())
    elems.append(P("ParkPeace is built entirely on free tiers. No credit card is required for any component."))
    elems.append(SP(8))
    data = [
        ["Service",          "Feature",                        "Free Tier Limit",               "Cost"],
        ["Supabase",         "Database (PostgreSQL)",           "500 MB storage",                "$0"],
        ["Supabase",         "Auth",                            "50,000 MAU",                    "$0"],
        ["Supabase",         "Edge Functions",                  "500,000 invocations/month",     "$0"],
        ["Supabase",         "Realtime",                        "200 concurrent connections",    "$0"],
        ["Firebase (FCM)",   "Push notifications",              "Unlimited messages",            "$0"],
        ["Vercel",           "Frontend hosting",                "Unlimited deploys, 100GB BW",   "$0"],
        ["GitHub Actions",   "CI/CD",                           "2,000 min/month",               "$0"],
        ["",                 "",                                "Total",                         "$0 / month"],
    ]
    t = Table(data, colWidths=[3.5*cm, 5*cm, 5.5*cm, 3*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0),  WHITE),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8.5),
        ("ROWBACKGROUNDS",(0,1), (-1,-2), [WHITE, GRAY_LIGHT]),
        ("BACKGROUND",    (0,-1),(-1,-1), PRIMARY_LT),
        ("TEXTCOLOR",     (2,-1),(-1,-1), PRIMARY),
        ("FONTNAME",      (2,-1),(-1,-1), "Helvetica-Bold"),
        ("GRID",          (0,0), (-1,-1), 0.3, GRAY_BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
    ]))
    elems.append(t)
    elems.append(SP(12))
    elems.append(Paragraph(
        "<b>Future enhancement:</b> Bridge calls via Twilio — connect scanner and owner via a server-side "
        "call for high-urgency contact scenarios. Twilio trial credit (~$15) covers ~550 minutes to Indian numbers.",
        STYLES["note"]
    ))
    elems.append(SP(30))
    elems.append(HR())
    elems.append(SP(6))
    elems.append(P("End of Document", "caption"))
    elems.append(P(f"ParkPeace Product Documentation · {datetime.datetime.now().strftime('%B %Y')}", "caption"))
    return elems


# ── Build ─────────────────────────────────────────────────────────────────────

def build():
    out = "/Users/I316427/Claude/ParkPeace/ParkPeace-Documentation.pdf"
    doc = make_doc(out)

    story = []
    story += build_cover()
    story += build_toc()
    story += section_overview()
    story += section_architecture()
    story += section_flows()
    story += section_techstack()
    story += section_schema()
    story += section_edge_functions()
    story += section_push()
    story += section_security()
    story += section_features()
    story += section_ios()
    story += section_deployment()
    story += section_cost()

    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print(f"✓ PDF generated: {out}")

build()
