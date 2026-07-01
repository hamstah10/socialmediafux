"""Server-side HTML preview builder for creatives.

Shared with the frontend for parity with any future PNG export via Playwright.
Supports template-driven variations: `background_type` (grid/diagonal/clean/solid)
and `config` (badge text, badge color override).
"""
from html import escape
from typing import Optional


FORMAT_SIZES = {
    "instagram_square": (1080, 1080),
    "instagram_story": (1080, 1920),
    "facebook_landscape": (1200, 630),
    "linkedin_square": (1200, 1200),
    "google_business": (1200, 900),
}


def _background_style(bg_type: str, primary: str) -> str:
    if bg_type == "grid":
        return (
            f"background:{primary};"
            "background-image:linear-gradient(#232D42 1px,transparent 1px),"
            "linear-gradient(90deg,#232D42 1px,transparent 1px);"
            "background-size:40px 40px;"
        )
    if bg_type == "diagonal":
        return (
            f"background:{primary};"
            "background-image:repeating-linear-gradient(135deg,"
            "rgba(35,45,66,0.55) 0 1px, transparent 1px 60px);"
        )
    if bg_type == "lines":
        return (
            f"background:{primary};"
            "background-image:repeating-linear-gradient(0deg,"
            "rgba(35,45,66,0.5) 0 1px, transparent 1px 24px);"
        )
    if bg_type == "clean":
        return f"background:{primary};"
    return f"background:{primary};"


def build_preview_html(*, customer: dict, format: str, headline: str,
                       subline: str, cta: str, logo_url: str = "",
                       template: Optional[dict] = None) -> str:
    template = template or {}
    config = template.get("config") or {}

    accent = config.get("accent") or customer.get("accent_color") or "#B4E600"
    primary = customer.get("primary_color") or "#080D1A"
    name = customer.get("name") or ""
    website = customer.get("website") or ""
    badge_text = config.get("badge") or (customer.get("tone_of_voice") or "Update")
    bg_type = template.get("background_type") or "grid"

    w, h = FORMAT_SIZES.get(format, (1080, 1080))
    bg_css = _background_style(bg_type, primary)

    logo_html = (
        f'<img src="{escape(logo_url)}" alt="" style="max-height:56px; max-width:180px; object-fit:contain;" />'
        if logo_url
        else f'<div style="font-weight:800; text-transform:uppercase; letter-spacing:.1em;">{escape(name)}</div>'
    )

    return f"""
<div class="fux-creative" style="
    width:100%; aspect-ratio:{w}/{h};
    {bg_css}
    color:#F5F7FA; position:relative;
    font-family:'Rajdhani','IBM Plex Sans',sans-serif; overflow:hidden;">
    <div style="position:absolute; inset:0; padding:8%; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="display:inline-block; padding:6px 12px; background:{accent}; color:#080D1A;
                font-weight:700; text-transform:uppercase; letter-spacing:.15em; font-size:0.75rem;">
                {escape(badge_text)}
            </div>
            {logo_html}
        </div>
        <div>
            <h2 style="font-size:clamp(2rem,4.5vw,3.5rem); line-height:1.05; margin:0;
                font-weight:800; text-transform:uppercase; letter-spacing:-0.02em;">
                {escape(headline)}
            </h2>
            {f'<p style="margin-top:1rem; font-size:1.1rem; color:#F5F7FA; opacity:0.85; max-width:80%;">{escape(subline)}</p>' if subline else ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="padding:12px 20px; background:{accent}; color:#080D1A; font-weight:700;
                text-transform:uppercase; letter-spacing:.12em; font-size:0.9rem;">
                {escape(cta) or "Jetzt anfragen"}
            </div>
            <div style="font-size:0.8rem; color:#8A94A6; text-transform:uppercase; letter-spacing:.15em;">
                {escape(website)}
            </div>
        </div>
    </div>
</div>
""".strip()
