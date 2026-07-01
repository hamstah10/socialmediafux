"""AI content generation service.

Uses Claude Sonnet 4.5 via emergentintegrations. Falls back to a deterministic
mock generator when no API key is present or on API failure — MVP guarantee
per the brief: the app must always produce usable copy.
"""
import json
import logging
import os
import re
from typing import Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"


PLATFORM_HINTS = {
    "instagram": "Instagram Post: kurz, aufmerksamkeitsstark, 3-5 Sätze, mit CTA.",
    "facebook": "Facebook Post: 4-6 Sätze, informativ mit klarem CTA.",
    "linkedin": "LinkedIn Post: seriös, B2B, technisch fundiert, 5-7 Sätze.",
    "google_business": "Google Business Update: sehr kurz (2-3 Sätze), lokal, klare Handlung.",
    "blog": "Blogartikel: strukturiert mit Meta-Title, Meta-Description, H1, Einleitung, technischer Erklärung, Vorteile, FAQ, CTA.",
    "newsletter": "Newsletter-Snippet: 4-6 Sätze, freundlich, informativ.",
    "whatsapp": "WhatsApp Broadcast: sehr kurz (2-3 Sätze), direkte Ansprache.",
}


def _build_prompt(customer: dict, news: Optional[dict], platform: str,
                  tone: str, cta: Optional[str], target_link: Optional[str],
                  custom_prompt: Optional[str]) -> str:
    services = ", ".join(customer.get("services", []) or [])
    parts = [
        f"Du schreibst Social-Media-Content für '{customer.get('name')}', "
        f"einen Automotive-/Chiptuning-Betrieb.",
        f"Website: {customer.get('website') or '-'}",
        f"Leistungen: {services or '-'}",
        f"Tonalität: {tone}",
        f"Plattform: {platform}. {PLATFORM_HINTS.get(platform, '')}",
    ]
    if news:
        parts.append("Basiere den Content auf folgender Branchen-News, aber KOPIERE keinen Satz:")
        parts.append(f"Titel: {news.get('title', '')}")
        parts.append(f"Zusammenfassung: {news.get('summary') or news.get('content_clean') or ''}")
    if custom_prompt:
        parts.append(f"Zusatzanweisung: {custom_prompt}")
    if cta:
        parts.append(f"Call-to-Action: {cta}")
    if target_link:
        parts.append(f"Link: {target_link}")

    parts.append(
        "Antworte ausschließlich als JSON-Objekt mit den Feldern: "
        "title (str), body (str), hashtags (list[str], je mit # Präfix), "
        "cta (str), meta_title (str, optional für blog), meta_description (str, optional für blog). "
        "Keine Erklärungen, kein Markdown-Codeblock."
    )
    return "\n".join(parts)


def _mock_generate(customer: dict, news: Optional[dict], platform: str, tone: str,
                   cta: Optional[str], target_link: Optional[str]) -> dict:
    name = customer.get("name", "Ihr Betrieb")
    services = customer.get("services") or []
    services_txt = ", ".join(services[:3]) if services else "Chiptuning"
    if news:
        title = f"{news.get('title', 'Neues aus dem Tuning')} – Kurz erklärt von {name}"
        summary = (news.get("summary") or news.get("content_clean") or "")[:280]
    else:
        title = f"Update von {name}: Mehr Performance, klare Ergebnisse"
        summary = f"Bei {name} setzen wir auf professionelle {services_txt}."

    body = (
        f"{summary}\n\n"
        f"Was das für Sie heißt: individuell abgestimmt auf Fahrzeug und Einsatzzweck. "
        f"Unser Fokus – Qualität, Nachvollziehbarkeit, saubere technische Umsetzung.\n\n"
        f"{cta or 'Jetzt Termin anfragen.'}"
    )
    hashtags = [f"#{t}" for t in ["chiptuning", "tuning", "performance", "ecutuning",
                                    "leistungssteigerung", "werkstatt", "kfz"]]
    return {
        "title": title[:120],
        "body": body,
        "hashtags": hashtags,
        "cta": cta or "Jetzt Termin vereinbaren",
        "meta_title": title[:60] if platform == "blog" else "",
        "meta_description": summary[:155] if platform == "blog" else "",
        "target_link": target_link or "",
    }


def _extract_json(text: str) -> Optional[dict]:
    # Strip common code fences
    text = re.sub(r"^```(?:json)?", "", text.strip())
    text = re.sub(r"```$", "", text.strip())
    # Find outermost braces
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


async def generate_content(customer: dict, news: Optional[dict], platform: str,
                           tone: str, cta: Optional[str], target_link: Optional[str],
                           custom_prompt: Optional[str] = None) -> dict:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.warning("No EMERGENT_LLM_KEY, using mock generator")
        return _mock_generate(customer, news, platform, tone, cta, target_link)

    try:
        prompt = _build_prompt(customer, news, platform, tone, cta, target_link, custom_prompt)
        chat = LlmChat(
            api_key=api_key,
            session_id=f"gen-{customer.get('id', 'x')}",
            system_message=(
                "Du bist ein deutscher Marketing-Experte für Automotive-, Chiptuning- "
                "und Werkstatt-Kunden. Du schreibst rechtssichere, professionelle "
                "Social-Media-Texte. Du verwendest niemals absolute Aussagen wie "
                "'100% legal', 'TÜV garantiert' oder 'garantiert mehr Leistung'."
            ),
        ).with_model(MODEL_PROVIDER, MODEL_NAME)

        response = await chat.send_message(UserMessage(text=prompt))
        parsed = _extract_json(response if isinstance(response, str) else str(response))
        if not parsed:
            logger.warning("AI response not parseable, falling back to mock")
            return _mock_generate(customer, news, platform, tone, cta, target_link)

        # Normalise hashtags
        raw_tags = parsed.get("hashtags") or []
        if isinstance(raw_tags, str):
            raw_tags = [t.strip() for t in re.split(r"[\s,]+", raw_tags) if t.strip()]
        hashtags = [(t if t.startswith("#") else f"#{t}") for t in raw_tags]

        return {
            "title": parsed.get("title", "")[:200],
            "body": parsed.get("body", ""),
            "hashtags": hashtags,
            "cta": parsed.get("cta") or (cta or ""),
            "meta_title": parsed.get("meta_title", ""),
            "meta_description": parsed.get("meta_description", ""),
            "target_link": target_link or "",
        }
    except Exception as e:
        logger.exception("AI generation failed: %s", e)
        return _mock_generate(customer, news, platform, tone, cta, target_link)



VARIANT_TONES = [
    ("technisch", "Sachlich, technisch fundiert, präzise. Ziel: Fachpublikum."),
    ("verkaufsstark", "Emotional, benefit-orientiert, mit klarem Kaufanreiz."),
    ("kurz", "Sehr knapp, maximal 2-3 Sätze, direkte Ansprache."),
]


async def generate_variants(customer: dict, news: Optional[dict], platform: str,
                            cta: Optional[str], target_link: Optional[str],
                            custom_prompt: Optional[str] = None) -> list[dict]:
    """Generate 3 variants in parallel with different tones."""
    import asyncio
    tasks = [
        generate_content(customer=customer, news=news, platform=platform,
                         tone=tone_key, cta=cta, target_link=target_link,
                         custom_prompt=(custom_prompt or "") + f" | Tonalität-Hinweis: {tone_hint}")
        for tone_key, tone_hint in VARIANT_TONES
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    variants: list[dict] = []
    for (tone_key, _), r in zip(VARIANT_TONES, results):
        if isinstance(r, Exception):
            r = _mock_generate(customer, news, platform, tone_key, cta, target_link)
        r["tone"] = tone_key
        variants.append(r)
    return variants


async def safe_rewrite(text: str, customer: Optional[dict] = None) -> str:
    """Rewrite riskante Aussagen zu sicheren Formulierungen via Claude."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        # Basic keyword replacement fallback
        replacements = {
            "100% legal": "ausschließlich für Motorsport, Export oder Offroad",
            "TÜV garantiert": "individuelle Prüfung je Fahrzeug erforderlich",
            "garantiert mehr Leistung": "realistische Leistungssteigerung je nach Fahrzeug",
            "DPF off legal": "DPF-Anpassung für Motorsport/Export",
            "AdBlue legal deaktivieren": "AdBlue-Anpassung für nicht-öffentliche Fahrzeuge",
        }
        out = text
        for k, v in replacements.items():
            out = re.sub(re.escape(k), v, out, flags=re.IGNORECASE)
        return out
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"rewrite-{customer.get('id', 'x') if customer else 'x'}",
            system_message=(
                "Du bist ein deutscher Rechts- und Marketing-Experte für Automotive-/"
                "Chiptuning-Content. Formuliere den gegebenen Text so um, dass er "
                "keine juristisch riskanten Aussagen enthält. Verboten: '100% legal', "
                "'TÜV garantiert', 'garantierte Leistung', 'DPF off legal', "
                "'AdBlue deaktivieren'. Ersetze durch neutralere Aussagen wie "
                "'für Motorsport-/Export-/Offroad-Anwendungen', 'individuelle Prüfung', "
                "'realistische Leistungssteigerung'. Behalte Botschaft, Länge und Ton bei. "
                "Antworte AUSSCHLIESSLICH mit dem neuen Text, ohne Erklärung, ohne Markdown."
            ),
        ).with_model(MODEL_PROVIDER, MODEL_NAME)
        response = await chat.send_message(UserMessage(text=text))
        return (response if isinstance(response, str) else str(response)).strip()
    except Exception as e:
        logger.warning("safe_rewrite failed: %s", e)
        return text
