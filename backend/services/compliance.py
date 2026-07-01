"""Compliance checker for automotive/tuning content.

Detects risky claims commonly used in chiptuning marketing that may cause
legal or reputational issues, and suggests safer wording.
"""
import re
from typing import TypedDict


RISKY_PATTERNS: list[tuple[str, str, str]] = [
    # (regex, warning, suggestion)
    (r"\b100\s*%\s*legal\b", "Riskante Aussage: '100% legal'",
     "Besser: 'ausschließlich für Motorsport, Export oder Offroad-Anwendungen'"),
    (r"tüv\s+garantiert", "Riskante Aussage: 'TÜV garantiert'",
     "Besser: 'individuelle Prüfung je Fahrzeug und Einsatzzweck erforderlich'"),
    (r"\bdpf\s*(off|entfernen|delete)\s*(legal)?\b", "Riskante Aussage: DPF Off / DPF Delete",
     "Besser: 'Anwendung nur für Motorsport, Export oder Offroad'"),
    (r"adblue\s+(legal\s+)?deaktivier", "Riskante Aussage: AdBlue deaktivieren",
     "Besser: 'für nicht-öffentlichen Motorsport-/Export-Einsatz'"),
    (r"garantiert\s+mehr\s+leistung", "Riskante Aussage: garantierte Leistung",
     "Besser: 'realistische Leistungssteigerung je nach Fahrzeug und Zustand'"),
    (r"keine\s+probleme\s+bei\s+kontrolle", "Riskante Aussage: 'keine Probleme bei Kontrolle'",
     "Besser: 'gesetzeskonforme Nutzung liegt in der Verantwortung des Halters'"),
    (r"illegal\s+umgehen", "Riskante Aussage: 'illegal umgehen'",
     "Besser: 'legale technische Umsetzung nach Kundenanforderung'"),
    (r"\bagr\s*(off|entfernen|delete)\b", "Riskante Aussage: AGR/EGR Off",
     "Besser: 'Anwendung nur für Motorsport, Export oder Offroad'"),
    (r"chip.?tuning.*ohne\s+eintragung", "Riskante Aussage: Tuning ohne Eintragung",
     "Besser: 'individuelle Prüfung und Eintragung nach § 21 StVZO empfohlen'"),
    (r"steuer(n)?\s+spar", "Riskante Aussage: 'Steuern sparen' durch Tuning",
     "Besser: neutralere Formulierung ohne steuerrechtliche Zusicherung"),
]


SAFE_SUGGESTIONS = [
    "Für Motorsport, Export oder Offroad-Anwendungen.",
    "Abhängig vom Fahrzeug und Einsatzzweck.",
    "Individuelle Prüfung erforderlich.",
    "Professionelle Softwarelösung.",
    "Technische Umsetzung nach Kundenanforderung.",
]


class ComplianceResult(TypedDict):
    ok: bool
    warnings: list[str]
    suggestions: list[str]
    safe_alternatives: list[str]


def check_compliance(text: str) -> ComplianceResult:
    warnings: list[str] = []
    suggestions: list[str] = []
    lower = text.lower()
    for pattern, warn, sug in RISKY_PATTERNS:
        if re.search(pattern, lower, re.IGNORECASE):
            warnings.append(warn)
            suggestions.append(sug)
    return {
        "ok": len(warnings) == 0,
        "warnings": warnings,
        "suggestions": suggestions,
        "safe_alternatives": SAFE_SUGGESTIONS,
    }
