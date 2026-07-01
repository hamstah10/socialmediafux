"""Hashtag generator for automotive/tuning content."""
import re


BASE_TAGS_DE = [
    "chiptuning", "tuning", "tuningfiles", "ecu", "ecutuning", "carsofinstagram",
    "performance", "leistungssteigerung", "motorsport", "kfz", "werkstatt",
    "diagnose", "codierung", "dieseltuning", "benzintuning",
]

PLATFORM_TAGS = {
    "instagram": ["reels", "instacar", "carsdaily", "petrolhead"],
    "facebook": ["auto", "cartuning", "gearhead"],
    "linkedin": ["automotive", "engineering", "b2b", "aftermarket"],
    "google_business": ["localbusiness", "kfzwerkstatt"],
    "blog": ["automotiveblog", "tuningblog"],
    "newsletter": ["news", "update"],
    "whatsapp": [],
}


def _clean_tag(t: str) -> str:
    t = re.sub(r"[^a-zA-Z0-9äöüßÄÖÜ_]", "", t.lower().replace(" ", ""))
    return t


def generate_hashtags(text: str, services: list[str] | None = None,
                      platform: str = "instagram", count: int = 12) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()

    def add(t: str) -> None:
        t = _clean_tag(t)
        if t and t not in seen and 2 < len(t) < 30:
            seen.add(t)
            tags.append(f"#{t}")

    for s in services or []:
        add(s)

    # Simple keyword extraction from text
    words = re.findall(r"[A-Za-zÄÖÜäöüß]{4,}", text)
    freq: dict[str, int] = {}
    for w in words:
        wl = w.lower()
        if wl in {"eine", "einen", "einem", "diese", "dieser", "dieses",
                  "durch", "unter", "über", "nach", "beim", "vom", "vor",
                  "mit", "und", "oder", "auch", "wenn", "aber", "kann",
                  "wird", "wurde", "sein", "sind", "wurde", "waren"}:
            continue
        freq[wl] = freq.get(wl, 0) + 1
    for w, _ in sorted(freq.items(), key=lambda x: -x[1])[:6]:
        add(w)

    for t in BASE_TAGS_DE:
        if len(tags) >= count:
            break
        add(t)

    for t in PLATFORM_TAGS.get(platform, []):
        if len(tags) >= count:
            break
        add(t)

    return tags[:count]
