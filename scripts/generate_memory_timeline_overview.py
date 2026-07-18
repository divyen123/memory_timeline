"""Generate the Memory Timeline application overview PDF.

Run with the Codex bundled Python runtime (or any Python with ReportLab):
    python scripts/generate_memory_timeline_overview.py

The final PDF is written to output/pdf/Memory_Timeline_Application_Overview.pdf.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "Memory_Timeline_Application_Overview.pdf"
PAGE_W, PAGE_H = A4

INK = HexColor("#171B2A")
BODY = HexColor("#3D4654")
MUTED = HexColor("#626B78")
NAVY = HexColor("#24457F")
ACCENT = HexColor("#3D8BFF")
ACCENT_DARK = HexColor("#214FC0")
CARD = HexColor("#F7F8FA")
CARD_BORDER = HexColor("#DDE2E8")
RULE = HexColor("#D9DEE5")
WHITE = HexColor("#FFFFFF")


def register_fonts() -> tuple[str, str, str]:
    """Register Segoe UI when available, with safe built-in fallbacks."""
    regular = Path("C:/Windows/Fonts/segoeui.ttf")
    semibold = Path("C:/Windows/Fonts/seguisb.ttf")
    bold = Path("C:/Windows/Fonts/segoeuib.ttf")

    if regular.exists():
        pdfmetrics.registerFont(TTFont("Memory-Regular", str(regular)))
        regular_name = "Memory-Regular"
    else:
        regular_name = "Helvetica"

    if semibold.exists():
        pdfmetrics.registerFont(TTFont("Memory-Semibold", str(semibold)))
        semibold_name = "Memory-Semibold"
    elif bold.exists():
        pdfmetrics.registerFont(TTFont("Memory-Semibold", str(bold)))
        semibold_name = "Memory-Semibold"
    else:
        semibold_name = "Helvetica-Bold"

    if bold.exists():
        pdfmetrics.registerFont(TTFont("Memory-Bold", str(bold)))
        bold_name = "Memory-Bold"
    else:
        bold_name = "Helvetica-Bold"

    return regular_name, semibold_name, bold_name


FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD = register_fonts()


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap_text(text: str, font: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if text_width(candidate, font, size) <= width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def draw_paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    font: str = FONT_REGULAR,
    size: float = 10,
    leading: float = 15,
    color=BODY,
) -> float:
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap_text(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def rich_lines(
    runs: list[tuple[str, str]], size: float, width: float
) -> list[list[tuple[str, str]]]:
    words: list[tuple[str, str]] = []
    for content, font in runs:
        words.extend((word, font) for word in content.split())

    result: list[list[tuple[str, str]]] = []
    current: list[tuple[str, str]] = []
    current_width = 0.0
    space_width = text_width(" ", FONT_REGULAR, size)

    for word, font in words:
        word_width = text_width(word, font, size)
        added_width = word_width + (space_width if current else 0)
        if current and current_width + added_width > width:
            result.append(current)
            current = [(word, font)]
            current_width = word_width
        else:
            current.append((word, font))
            current_width += added_width

    if current:
        result.append(current)
    return result


def draw_rich_line(c: canvas.Canvas, line: list[tuple[str, str]], x: float, y: float, size: float) -> None:
    cursor = x
    for index, (word, font) in enumerate(line):
        if index:
            cursor += text_width(" ", FONT_REGULAR, size)
        c.setFont(font, size)
        c.drawString(cursor, y, word)
        cursor += text_width(word, font, size)


def draw_bullet(
    c: canvas.Canvas,
    label: str,
    description: str,
    x: float,
    y: float,
    width: float,
    *,
    size: float = 8.25,
    leading: float = 11.7,
    gap: float = 8,
) -> float:
    text_x = x + 16
    c.setFillColor(INK)
    c.circle(x + 4.1, y + 3.2, 1.45, stroke=0, fill=1)
    c.setFillColor(BODY)
    lines = rich_lines(
        [(label, FONT_BOLD), ("- " + description, FONT_REGULAR)],
        size,
        width - 16,
    )
    for line in lines:
        draw_rich_line(c, line, text_x, y, size)
        y -= leading
    return y - gap


def round_card(c: canvas.Canvas, x: float, y: float, width: float, height: float, radius: float = 9) -> None:
    c.setFillColor(CARD)
    c.setStrokeColor(CARD_BORDER)
    c.setLineWidth(0.8)
    c.roundRect(x, y, width, height, radius, stroke=1, fill=1)


def section_header(c: canvas.Canvas, title: str) -> None:
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 14.2)
    c.drawString(72, 790, title)
    c.setStrokeColor(RULE)
    c.setLineWidth(1)
    c.line(72, 776, PAGE_W - 72, 776)


def card_title(c: canvas.Canvas, title: str, x: float, y: float) -> None:
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 10.6)
    c.drawString(x, y, title)


def draw_bullet_card(
    c: canvas.Canvas,
    title: str,
    items: list[tuple[str, str]],
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    size: float = 8.25,
    leading: float = 11.7,
    gap: float = 8,
) -> None:
    round_card(c, x, y, width, height)
    card_title(c, title, x + 15, y + height - 28)
    cursor_y = y + height - 54
    for label, description in items:
        cursor_y = draw_bullet(
            c,
            label,
            description,
            x + 15,
            cursor_y,
            width - 30,
            size=size,
            leading=leading,
            gap=gap,
        )


def draw_feature(c: canvas.Canvas, title: str, description: str, y: float) -> float:
    x = 72
    text_x = 86
    width = PAGE_W - 72 - text_x
    c.setFillColor(ACCENT)
    desc_lines = wrap_text(description, FONT_REGULAR, 9.15, width)
    row_height = 27 + len(desc_lines) * 13.7
    c.roundRect(x, y - row_height + 8, 3, row_height, 1.5, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 9.9)
    c.drawString(text_x, y, title)
    draw_paragraph(
        c,
        description,
        text_x,
        y - 20,
        width,
        size=9.15,
        leading=13.7,
        color=MUTED,
    )
    return y - row_height - 12


def draw_small_card(
    c: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    title: str,
    body: str,
    *,
    centered: bool = False,
) -> None:
    round_card(c, x, y, width, height, 8)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 9.6)
    if centered:
        c.drawCentredString(x + width / 2, y + height - 24, title)
        lines = wrap_text(body, FONT_REGULAR, 7.6, width - 20)
        body_y = y + height - 43
        c.setFillColor(MUTED)
        c.setFont(FONT_REGULAR, 7.6)
        for line in lines:
            c.drawCentredString(x + width / 2, body_y, line)
            body_y -= 10.7
    else:
        c.drawString(x + 12, y + height - 20, title)
        draw_paragraph(
            c,
            body,
            x + 12,
            y + height - 36,
            width - 24,
            size=7.55,
            leading=10.3,
            color=MUTED,
        )


def draw_arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float) -> None:
    c.setStrokeColor(ACCENT)
    c.setFillColor(ACCENT)
    c.setLineWidth(1.15)
    c.line(x1, y1, x2, y2)
    if abs(x2 - x1) >= abs(y2 - y1):
        direction = 1 if x2 > x1 else -1
        c.line(x2, y2, x2 - 5 * direction, y2 + 3)
        c.line(x2, y2, x2 - 5 * direction, y2 - 3)
    else:
        direction = 1 if y2 > y1 else -1
        c.line(x2, y2, x2 - 3, y2 - 5 * direction)
        c.line(x2, y2, x2 + 3, y2 - 5 * direction)


def page_one(c: canvas.Canvas) -> None:
    x, y, width, height = 72, 628, PAGE_W - 144, 128
    c.saveState()
    path = c.beginPath()
    path.roundRect(x, y, width, height, 12)
    c.clipPath(path, stroke=0, fill=0)
    c.linearGradient(
        x,
        y,
        x + width,
        y,
        (HexColor("#2145B7"), HexColor("#3D8BFF")),
        extend=True,
    )
    c.restoreState()

    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 23.5)
    c.drawString(x + 30, y + 76, "Memory Timeline")
    c.setFont(FONT_REGULAR, 11.3)
    c.drawString(x + 30, y + 47, "Comprehensive Application Overview & Technology Stack")
    c.drawString(x + 30, y + 28, "Specifications")

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 14.2)
    c.drawString(72, 580, "1. EXECUTIVE DESCRIPTION")
    c.setStrokeColor(RULE)
    c.setLineWidth(1)
    c.line(72, 566, PAGE_W - 72, 566)

    description = (
        "Memory Timeline is a full-stack personal archive for preserving, organizing, and "
        "revisiting image-based memories in a private visual workspace. Users can create rich "
        "multi-image entries with dates, categories, descriptions, favorites, and reminders; "
        "explore them in timeline, calendar, or compact tile layouts; search, sort, filter, share "
        "individual memories, and export image collections. Reminder delivery uses permission-based "
        "browser push notifications for each enabled device, backed by a service worker, VAPID, "
        "and retry-aware scheduling. The application also provides a PIN-gated Hidden Images "
        "interface, 30-day Trash recovery, profile and account controls, responsive layouts, and "
        "extensive per-device appearance, sound, and interaction settings."
    )
    draw_paragraph(c, description, 72, 537, PAGE_W - 144, size=10.25, leading=18.7, color=BODY)


def page_two(c: canvas.Canvas) -> None:
    section_header(c, "2. TECHNOLOGY STACK SPECIFICATIONS")
    gap = 15
    card_width = (PAGE_W - 144 - gap) / 2

    frontend = [
        ("React 19", "Component-driven interface and stateful user workflows"),
        ("Vite 7", "Fast development server and optimized production bundling"),
        ("React Router 7", "Protected routes, public share links, and navigation"),
        ("Framer Motion 12", "Page transitions, onboarding, and shared-layout motion"),
        ("Axios", "API client with credentials, CSRF support, and session refresh"),
        ("Service Worker and Web APIs", "Push handling, Web Audio, Canvas, and local preferences"),
    ]
    backend = [
        ("Node.js and Express 5", "REST API, middleware, and application runtime"),
        ("Mongoose 9", "MongoDB schemas, indexes, queries, and lifecycle state"),
        ("JWT and cookie sessions", "Rotating access and refresh authentication"),
        ("bcryptjs", "Password and Hidden PIN hashing"),
        ("Multer and Sharp", "Validated uploads, WebP normalization, and thumbnails"),
        ("sanitize-html and web-push", "Safe rich text and VAPID-authenticated push delivery"),
    ]
    draw_bullet_card(c, "Frontend Ecosystem", frontend, 72, 433, card_width, 318)
    draw_bullet_card(c, "Backend Ecosystem", backend, 72 + card_width + gap, 433, card_width, 318)

    deployment = [
        ("MongoDB Atlas", "Stores users, memories, sessions, settings, share links, subscriptions, and delivery records"),
        ("Cloudinary", "Authenticated production media storage with AES-256-GCM encryption enabled by default"),
        ("Web Push and VAPID", "Per-device opt-in delivery through provider endpoints and a browser service worker"),
        ("Vercel and Render", "Frontend and API deployment with health checks and environment-based configuration"),
    ]
    draw_bullet_card(
        c,
        "Database, Media & Delivery",
        deployment,
        72,
        96,
        PAGE_W - 144,
        312,
        size=8.35,
        leading=12.2,
        gap=10,
    )


def page_three(c: canvas.Canvas) -> None:
    section_header(c, "3. APPLICATION PAGES & COMPONENTS")
    features = [
        ("Accounts & Guided Onboarding", "Registration, sign-in, session restore, password recovery and change, profile setup, and a six-step guided tour introduce the main workflows."),
        ("Create & Edit Memories", "Add a title, rich-text story, memory date, optional reminder, category, and up to 10 JPG, PNG, or WebP images of up to 8 MB each."),
        ("Optimized Image Pipeline", "The browser and API create WebP full-view images and lightweight thumbnails; edits can retain, add, or remove individual images."),
        ("Timeline Home", "Browse chronological cards with lazy paging, automatic loading, and timeline virtualization for larger desktop and mobile collections."),
        ("Calendar & Compact Tile Views", "Switch to month-grouped calendar cards or a dense gallery, and save the preferred default view independently for each device profile."),
        ("Search, Sort, Filter & Favorites", "Search titles, stories, and categories; sort newest or oldest; filter by category or favorites; and star important memories."),
        ("Rich Preview Carousel & Zoom", "Open animated previews with multi-image navigation, swipe gestures, full-screen viewing, zoom and pan, image details, and direct actions."),
    ]
    y = 741
    for title, description in features:
        y = draw_feature(c, title, description, y)


def page_four(c: canvas.Canvas) -> None:
    section_header(c, "3. APPLICATION COMPONENTS (CONTINUED)")
    features = [
        ("Reminders & Browser Push", "Set special dates and a lead window; review upcoming items; play an in-app sound; dismiss for today; snooze until tomorrow; and opt in to background push on each device."),
        ("Private Sharing & Public View", "Create a time-limited public link for one memory, share through the device or clipboard, and present the owner, date, category, story, and images to recipients."),
        ("Image Export & Personal Backups", "Export images from all memories, selected visible memories, or category/date/favorite filters; one image downloads directly and multiple images become a ZIP."),
        ("Hidden Images", "Move items out of the main timeline into a dedicated interface protected by a four-digit UI PIN, then preview, unhide, or permanently delete them."),
        ("Trash & Recovery", "Deleted memories remain recoverable for 30 days. Restore one or many items, permanently remove selected items, empty the bin, or allow automatic expiry."),
        ("Profile, Insights & Account Controls", "Manage profile details and photo; view totals and a category chart; change the password; clear memories to Trash; revoke sessions; or delete the account."),
        ("Personalization, Backup & Accessibility", "Separate desktop/mobile profiles cover themes, animated backgrounds, cards, controls, glass effects, fonts, hover, sounds, reminder lead time, reduced motion, and JSON settings backup/restore."),
    ]
    y = 741
    for title, description in features:
        y = draw_feature(c, title, description, y)


def page_five(c: canvas.Canvas) -> None:
    section_header(c, "4. SECURITY, PRIVACY & DATA LIFECYCLE")
    gap = 15
    card_width = (PAGE_W - 144 - gap) / 2
    identity = [
        ("Strong password policy", "At least 10 characters with upper, lower, and numeric characters"),
        ("bcryptjs hashing", "Passwords and Hidden PINs are stored as one-way hashes"),
        ("Rotating sessions", "Short-lived JWT access plus opaque refresh tokens stored as hashes"),
        ("Session revocation", "Logout, logout-all, password change, and reset invalidate sessions"),
        ("Attempt controls", "Global API, login, reset, and Hidden PIN update throttles"),
    ]
    request = [
        ("CSRF and origin checks", "State-changing requests require a valid token and approved origin"),
        ("CORS allowlist", "Credentialed browser access is limited to configured origins"),
        ("Helmet policies", "Content Security Policy, frame blocking, and safer response headers"),
        ("Ownership and sanitization", "Private media and queries are user-scoped; accepted rich content and settings keys are filtered"),
        ("Push security boundary", "HTTPS provider allowlisting, key validation, VAPID signing, and private subscription fields"),
    ]
    draw_bullet_card(c, "Identity & Sessions", identity, 72, 433, card_width, 318, size=8.15, leading=11.8, gap=8)
    draw_bullet_card(c, "Request, API & Push Protection", request, 72 + card_width + gap, 433, card_width, 318, size=8.05, leading=11.65, gap=7)

    lifecycle = [
        ("Strict upload validation", "MIME type, extension, count, file size, metadata, and pixel limits are checked"),
        ("Normalized derivatives", "Sharp rotates, resizes, and writes full images and thumbnails as WebP"),
        ("Protected delivery", "Cloudinary uses authenticated assets; private images stream through ownership-checked API routes"),
        ("Encrypted cloud media", "AES-256-GCM is enabled by default before raw Cloudinary storage"),
        ("Hidden Images PIN", "A salted PBKDF2-SHA-256 value gates the browser interface; the app password is required to change it"),
        ("Expiring data paths", "Public links are time-limited, Trash purges after 30 days, and expired push endpoints and ledgers are cleaned up"),
    ]
    draw_bullet_card(
        c,
        "Media & Data Lifecycle",
        lifecycle,
        72,
        76,
        PAGE_W - 144,
        332,
        size=8.15,
        leading=11.7,
        gap=7,
    )


def page_six(c: canvas.Canvas) -> None:
    section_header(c, "5. SYSTEM ARCHITECTURE & DELIVERY")
    box_w = 127
    box_h = 64
    xs = [72, 234, 396]

    draw_small_card(c, xs[0], 686, box_w, box_h, "React / Vite PWA", "Responsive UI and per-device preferences", centered=True)
    draw_small_card(c, xs[1], 686, box_w, box_h, "Express API", "Authentication, media, and subscription APIs", centered=True)
    draw_small_card(c, xs[2], 686, box_w, box_h, "MongoDB Atlas", "Users, memories, sessions, and push records", centered=True)
    draw_arrow(c, xs[0] + box_w + 6, 718, xs[1] - 6, 718)
    draw_arrow(c, xs[1] + box_w + 6, 718, xs[2] - 6, 718)

    draw_small_card(c, xs[0], 576, box_w, box_h, "Cloudinary Media", "Authenticated encrypted image storage", centered=True)
    draw_small_card(c, xs[1], 576, box_w, box_h, "Reminder Scheduler", "Timezone-aware scan, ledger, and retries", centered=True)
    draw_small_card(c, xs[2], 576, box_w, box_h, "Web Push + Worker", "VAPID delivery to the browser service worker", centered=True)

    api_center = xs[1] + box_w / 2
    cloud_center = xs[0] + box_w / 2
    scheduler_center = xs[1] + box_w / 2
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.15)
    c.line(api_center, 686, api_center, 660)
    c.line(cloud_center, 660, scheduler_center, 660)
    draw_arrow(c, cloud_center, 660, cloud_center, 646)
    draw_arrow(c, scheduler_center, 660, scheduler_center, 646)
    draw_arrow(c, xs[1] + box_w + 6, 608, xs[2] - 6, 608)

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 10.9)
    c.drawString(72, 545, "Core Data Models")
    model_gap = 15
    model_w = (PAGE_W - 144 - model_gap) / 2
    draw_small_card(c, 72, 481, model_w, 48, "User", "Profile, onboarding state, and mobile/desktop settings")
    draw_small_card(c, 72 + model_w + model_gap, 481, model_w, 48, "Memory", "Story, media, date, category, reminder, and lifecycle state")
    draw_small_card(c, 72, 418, model_w, 48, "Session & ShareLink", "Hashed sessions plus random, expiring, revocable public links")
    draw_small_card(c, 72 + model_w + model_gap, 418, model_w, 48, "PushSubscription & PushDelivery", "Per-device endpoint metadata and idempotent delivery state")

    notes_x, notes_y, notes_w, notes_h = 72, 53, PAGE_W - 144, 342
    round_card(c, notes_x, notes_y, notes_w, notes_h)
    card_title(c, "Current Implementation Notes", notes_x + 15, notes_y + notes_h - 28)
    notes = [
        ("Push opt-in", "Profile enables notifications separately on each browser or device; permission, service worker support, HTTPS, and stable VAPID keys are required"),
        ("Private payload", "The notification contains a generic title and message, opens /timeline, and does not expose memory content on the lock screen"),
        ("Delivery semantics", "A subscription/memory/date ledger provides idempotency, atomic leases, bounded retries, and retention; 404 or 410 responses remove stale endpoints"),
        ("Time and scope", "IANA time zones and the user's lead window drive due scans; hidden, trashed, reserved, changed, and deleted reminders are excluded"),
        ("Platform boundary", "On iPhone and iPad, push opt-in requires the app to be installed to the Home Screen and opened in standalone mode"),
        ("Known product boundaries", "Visible export produces images or ZIP files; settings backup excludes memory records and photos; reset codes remain process-local without production delivery"),
    ]
    cursor_y = notes_y + notes_h - 55
    for label, description in notes:
        cursor_y = draw_bullet(
            c,
            label,
            description,
            notes_x + 15,
            cursor_y,
            notes_w - 30,
            size=8.05,
            leading=11.25,
            gap=6,
        )


def generate() -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("Memory Timeline Application Overview")
    c.setSubject("Comprehensive application overview and technology stack specifications")
    c.setAuthor("Memory Timeline")
    c.setCreator("Memory Timeline overview generator")

    pages = [page_one, page_two, page_three, page_four, page_five, page_six]
    for page in pages:
        page(c)
        c.showPage()
    c.save()
    return OUTPUT


if __name__ == "__main__":
    generated = generate()
    print(generated)
