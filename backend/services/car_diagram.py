"""Motorraum-/Kofferraum-Schaubild-Generierung via OpenAI Images.

Erzeugt fotorealistische Basisbilder (leerer Motorraum/Kofferraum) und darauf
aufbauende beschriftete technische Schaubilder (Bauteil-Markierungen, Pfeile,
Titelbox). Kein Text-Fallback wie beim Claude-Service — ohne API-Key ist die
Funktion in der UI deaktiviert (siehe `openai_configured` in /api/settings).
"""
import base64
import os
from typing import List, Optional

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

MODEL_NAME = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1.5")
IMAGE_SIZE = os.environ.get("OPENAI_IMAGE_SIZE", "1536x1024")


def build_base_prompt(vehicle: str, year: str, engine: str,
                      perspective: str = "Motorraum von oben, Motorhaube offen",
                      image_area: str = "motorroom") -> str:
    if image_area == "trunk":
        view = "Kofferraum geöffnet, Blick von hinten in den Kofferraum, Seitenteile und Bodenbereich sichtbar"
        return f"""
Erstelle ein sauberes fotorealistisches Kofferraum-Basisbild ohne Markierungen und ohne Text.
Fahrzeug: {vehicle}
Baujahr/Generation: {year}
Motor/Variante: {engine}
Ansicht: {view}
Stil: realistisches Werkstattfoto, kompletter Kofferraum-/Heckbereich, gutes Licht, keine Pfeile, keine Kreise, keine Labels, keine Schrift.
""".strip()
    return f"""
Erstelle ein sauberes fotorealistisches Motorraum-Basisbild ohne Markierungen und ohne Text.
Fahrzeug: {vehicle}
Baujahr/Generation: {year}
Motor: {engine}
Ansicht: {perspective}
Stil: realistisches Werkstattfoto, komplette Motorraumansicht, gutes Licht, keine Pfeile, keine Kreise, keine Labels, keine Schrift.
""".strip()


def build_diagram_prompt(*, vehicle: str, year: str, engine: str, diagram_title: str,
                         markings: List[str], perspective: str, language: str,
                         detail_view: bool, realistic: bool, notes: Optional[str],
                         reuse_base: bool) -> str:
    markings_block = "\n".join([f"- {m}" for m in markings]) or "- keine Markierungen angegeben"
    realism = "fotorealistisch, sehr hochwertig, echtes Werkstatt-/OEM-Handbuch-Niveau" if realistic else "technische Illustration"
    base = ("Nutze das gespeicherte Basisbild als feste Grundlage. Perspektive, Fahrzeugbereich und "
            "Bauteile sollen erhalten bleiben. Füge nur Markierungen, Pfeile, Kreise, Titelbox und "
            "Beschriftungen hinzu.") if reuse_base else \
           "Erzeuge den passenden Fahrzeugbereich zum genannten Fahrzeug und Motor komplett per KI."
    return f"""
Erstelle ein fertiges technisches Fahrzeug-Schaubild als ein einziges Bild.

{base}

Fahrzeug: {vehicle}
Baujahr/Generation: {year}
Motor: {engine}
Ansicht: {perspective}
Sprache der Beschriftungen: {language}
Haupttitel: {diagram_title}
Stil: {realism}

Wichtig:
- professionelle Diagnosegrafik / OEM-Handbuch-Look
- oben links schwarze halbtransparente Titelbox
- erste Zeile: Fahrzeug
- zweite Zeile: Motor
- dritte Zeile gelb: Haupttitel
- farbige Kreise direkt an den Bauteilen
- Pfeile/Linien von Labelboxen zum jeweiligen Bauteil
- Labelboxen gut lesbar, hoher Kontrast
- keine Fantasie-Texte außer den gewünschten Markierungen
- keine abgeschnittenen Labels
- Querformat 3:2

Zu markieren und zu beschriften:
{markings_block}

Detailansicht: {'unten rechts eine kleine Detailansicht/Zoom-Box für das wichtigste Bauteil hinzufügen' if detail_view else 'keine Detailansicht'}
Zusatzhinweise: {notes or 'keine'}
""".strip()


def _client() -> "OpenAI":
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        raise RuntimeError("OPENAI_API_KEY fehlt")
    return OpenAI(api_key=api_key)


def generate_image(prompt: str, base_image_bytes: Optional[bytes] = None) -> tuple[bytes, str]:
    """Generiert ein Bild per OpenAI. Gibt (png_bytes, mode) zurück.

    Bei vorhandenem Basisbild wird `images.edit` versucht (Bildbearbeitung
    des wiederverwendeten Basisbilds); scheitert das SDK/Modell daran, wird
    automatisch auf reine `images.generate` mit demselben Prompt zurückgefallen.
    """
    client = _client()
    if base_image_bytes:
        try:
            import io
            image_file = io.BytesIO(base_image_bytes)
            image_file.name = "base.png"
            result = client.images.edit(model=MODEL_NAME, image=image_file, prompt=prompt, size=IMAGE_SIZE, n=1)
            mode = "openai_edit_reused_base"
        except Exception:
            result = client.images.generate(model=MODEL_NAME, prompt=prompt, size=IMAGE_SIZE, n=1)
            mode = "openai_generate_fallback_from_reuse_prompt"
    else:
        result = client.images.generate(model=MODEL_NAME, prompt=prompt, size=IMAGE_SIZE, n=1)
        mode = "openai_generate"
    return base64.b64decode(result.data[0].b64_json), mode
