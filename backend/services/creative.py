"""Server-side HTML preview builder for creatives.

Kept as a helper so the frontend and a future PNG-export (Playwright) share
the same layout logic.
"""
from html import escape


def build_preview_html(*, customer: dict, format: str, headline: str,
                       subline: str, cta: str, logo_url: str = "") -> str:
    accent = customer.get("accent_color") or "#B4E600"
    primary = customer.get("primary_color") or "#080D1A"
    name = customer.get("name") or ""
    website = customer.get("website") or ""

    sizes = {
        "instagram_square": (1080, 1080),
        "instagram_story": (1080, 1920),
        "facebook_landscape": (1200, 630),
        "linkedin_square": (1200, 1200),
        "google_business": (1200, 900),
    }
    w, h = sizes.get(format, (1080, 1080))

    return f"""
<div class="fux-creative" style="
    width:100%; aspect-ratio:{w}/{h}; background:{primary};
    color:#F5F7FA; position:relative; font-family:'Rajdhani','IBM Plex Sans',sans-serif;
    background-image:linear-gradient(#232D42 1px,transparent 1px),linear-gradient(90deg,#232D42 1px,transparent 1px);
    background-size:40px 40px; overflow:hidden;">
    <div style="position:absolute; inset:0; padding:8%; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="display:inline-block; padding:6px 12px; background:{accent}; color:#080D1A;
                font-weight:700; text-transform:uppercase; letter-spacing:.15em; font-size:0.75rem;">
                {escape(customer.get("tone_of_voice") or "Update")}
            </div>
            {f'<img src="{escape(logo_url)}" style="max-height:56px; max-width:180px; object-fit:contain;" />' if logo_url else f'<div style="font-weight:800; text-transform:uppercase; letter-spacing:.1em;">{escape(name)}</div>'}
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
