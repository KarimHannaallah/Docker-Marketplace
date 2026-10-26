"""Génération de slugs (identifiants lisibles pour les URLs)."""

import re
import unicodedata


def slugify(text: str) -> str:
    # "Café crème" -> "cafe-creme"
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug or "item"
