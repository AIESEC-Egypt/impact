"""Parse legacy Academy/*.html pages into material records."""

import re
from pathlib import Path

HTML_TO_ACADEMY_KEY = {
    "oGV.html": "ogv",
    "iGV.html": "igv",
    "oGT.html": "ogt",
    "iGT.html": "igt",
    "B2C.html": "b2c",
    "B2B.html": "b2b",
    "MXP.html": "tm",
    "F&L.html": "fl",
}


def _title_from_card_path(card_image: str) -> str:
    name = Path(card_image).name
    if name.endswith(".svg"):
        name = name[:-4]
    if name.endswith(".pdf"):
        name = name[:-4]
    for ext in (".png", ".jpeg", ".jpg", ".webp"):
        if name.lower().endswith(ext):
            name = name[: -len(ext)]
    return name.replace("_", " ").strip() or card_image


def parse_academy_html(html: str) -> list[dict]:
    """Return list of material dicts from one legacy academy HTML file."""
    materials = []
    seen_cards = set()
    order = 0
    chunks = re.split(r'<div class="session-title">', html, flags=re.IGNORECASE)
    current_section = ""

    def add_item(item: dict) -> None:
        nonlocal order
        key = item.get("card_image") or item.get("url") or item.get("title")
        if key in seen_cards:
            return
        seen_cards.add(key)
        order += 1
        item["order"] = order
        materials.append(item)

    for chunk in chunks[1:]:
        section_match = re.match(r"\s*([^<]+?)\s*</div>", chunk, re.DOTALL)
        if section_match:
            current_section = re.sub(r"\s+", " ", section_match.group(1)).strip()

        # Drive link wrapping an img
        for match in re.finditer(
            r'<a\s+href="(https?://[^"]+)"[^>]*>\s*<img\s+src="([^"]+)"',
            chunk,
            re.IGNORECASE,
        ):
            card_image = _normalize_card_path(match.group(2))
            add_item(
                {
                    "section_group": current_section,
                    "title": _title_from_card_path(card_image),
                    "card_image": card_image,
                    "pdf_filename": "",
                    "url": match.group(1),
                }
            )

        # onclick openPDF cards
        for match in re.finditer(
            r'onclick="openPDF\(\'([^\']+)\'\)"[^>]*>\s*<img\s+src="([^"]+)"',
            chunk,
            re.IGNORECASE | re.DOTALL,
        ):
            pdf_slug = match.group(1).strip()
            card_image = _normalize_card_path(match.group(2))
            add_item(
                {
                    "section_group": current_section,
                    "title": _title_from_card_path(card_image),
                    "card_image": card_image,
                    "pdf_filename": "",
                    "url": "",
                }
            )

        # Plain img cards (e.g. oGT image grids) — skip if inside a drive <a>
        chunk_no_anchors = re.sub(
            r'<a\s+href="https?://[^"]+"[^>]*>.*?</a>',
            "",
            chunk,
            flags=re.IGNORECASE | re.DOTALL,
        )
        for match in re.finditer(
            r'<img\s+src="(pdf/[^"]+)"', chunk_no_anchors, re.IGNORECASE
        ):
            card_image = _normalize_card_path(match.group(1))
            add_item(
                {
                    "section_group": current_section,
                    "title": _title_from_card_path(card_image),
                    "card_image": card_image,
                    "pdf_filename": "",
                    "url": "",
                }
            )

    return materials


def _normalize_card_path(path: str) -> str:
    path = path.strip().replace("\\", "/")
    if path.startswith("pdf/"):
        return f"Academy/{path}"
    if path.startswith("Academy/"):
        return path
    return path


def load_legacy_academy_materials(base_dir: Path) -> dict[str, list[dict]]:
    """Parse all legacy Academy HTML files under base_dir/Academy/."""
    academy_dir = base_dir / "Academy"
    result = {}
    if not academy_dir.is_dir():
        return result

    for filename, key in HTML_TO_ACADEMY_KEY.items():
        path = academy_dir / filename
        if not path.is_file():
            continue
        html = path.read_text(encoding="utf-8", errors="replace")
        items = parse_academy_html(html)
        if items:
            result[key] = items
    return result
