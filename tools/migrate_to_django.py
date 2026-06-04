"""One-time migration helper.

Copies the legacy static assets into static/ and the legacy HTML pages into
templates/, rewriting:
  * asset references (href/src/url) to absolute /static/... paths
  * inter-page navigation links to Django route paths

The legacy HTML contains no Django template syntax, so the rewritten files can
be rendered safely by the template engine. CSS files are copied untouched
because their relative url() references resolve correctly under /static/.

Run from the project root:  python tools/migrate_to_django.py
"""

import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC = os.path.join(ROOT, "static")
TEMPLATES = os.path.join(ROOT, "templates")

# Asset files/dirs to copy into static/ (source path relative to ROOT).
ASSET_PATHS = [
    "styles.css",
    "styles.min.css",
    "script.js",
    "ranking-script.js",
    "icx-apds-submissions.js",
    "b2b-contracts-submit.js",
    "fonts",
    "image",
    "Middel Video",
    "Academy",
    "AiE",
    "aspects",
    "css",
]

# HTML pages to copy into templates/ (source rel path -> dest rel path).
HTML_PAGES = {
    "index.html": "index.html",
    "dreaming.html": "dreaming.html",
    "membership-ranking.html": "membership-ranking.html",
    "icx-apds-submissions.html": "icx-apds-submissions.html",
    "b2b-contracts.html": "b2b-contracts.html",
    "Academy/oGV.html": "Academy/oGV.html",
    "Academy/iGV.html": "Academy/iGV.html",
    "Academy/oGT.html": "Academy/oGT.html",
    "Academy/iGT.html": "Academy/iGT.html",
    "Academy/B2C.html": "Academy/B2C.html",
    "Academy/B2B.html": "Academy/B2B.html",
    "Academy/MXP.html": "Academy/MXP.html",
    "Academy/F&L.html": "Academy/F&L.html",
    "Academy/presentation.html": "Academy/presentation.html",
    "AiE/History.html": "AiE/History.html",
}

# Base directory (web-root relative) of each source page, for resolving
# relative asset paths.
PAGE_BASEDIR = {
    "Academy": ("Academy/",),
    "AiE": ("AiE/",),
}

PAGE_MAP = {
    "index.html": "/",
    "dreaming.html": "/dreaming/",
    "membership-ranking.html": "/membership-ranking/",
    "icx-apds-submissions.html": "/icx-apds-submissions/",
    "b2b-contracts.html": "/b2b-contracts/",
    "history.html": "/history/",
    "presentation.html": "/presentation/",
}

ACADEMY_MAP = {
    "ogv": "ogv",
    "igv": "igv",
    "ogt": "ogt",
    "igt": "igt",
    "b2c": "b2c",
    "b2b": "b2b",
    "mxp": "mxp",
    "f&l": "fl",
}

SKIP_PREFIXES = (
    "http://", "https://", "//", "#", "mailto:", "tel:", "data:",
    "javascript:", "/static/", "{", "/",
)


def basedir_for(dest_rel):
    parts = dest_rel.split("/")
    if len(parts) > 1:
        return parts[0] + "/"
    return ""


def map_page_link(value):
    """Return a Django route for an internal .html link, else None."""
    frag = ""
    path = value
    for sep in ("#", "?"):
        if sep in path:
            path, _, rest = path.partition(sep)
            frag = sep + rest
            break
    base = os.path.basename(path).lower()
    if base in PAGE_MAP:
        return PAGE_MAP[base] + frag
    if base.endswith(".html"):
        stem = base[:-5]
        if stem in ACADEMY_MAP:
            return f"/academy/{ACADEMY_MAP[stem]}/" + frag
    return None


def to_static(value, basedir):
    normalized = os.path.normpath(os.path.join(basedir, value)).replace("\\", "/")
    normalized = normalized.lstrip("/")
    return "/static/" + normalized


def transform_value(value, basedir):
    v = value.strip()
    if not v:
        return value
    low = v.lower()
    if low.startswith(SKIP_PREFIXES):
        return value
    page = map_page_link(v)
    if page is not None:
        return page
    return to_static(v, basedir)


def rewrite_html(text, basedir):
    def attr_repl(m):
        attr, quote, val = m.group(1), m.group(2), m.group(3)
        return f"{attr}={quote}{transform_value(val, basedir)}{quote}"

    text = re.sub(r'\b(href|src)=(["\'])(.*?)\2', attr_repl, text)

    def url_repl(m):
        quote, val = m.group(1), m.group(2)
        return f"url({quote}{transform_value(val, basedir)}{quote})"

    text = re.sub(r'url\(\s*(["\']?)([^)\'"]+)\1\s*\)', url_repl, text)
    return text


def copy_assets():
    os.makedirs(STATIC, exist_ok=True)
    for rel in ASSET_PATHS:
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print(f"  skip (missing): {rel}")
            continue
        dst = os.path.join(STATIC, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)
        print(f"  copied: {rel}")


def copy_pages():
    os.makedirs(TEMPLATES, exist_ok=True)
    for src_rel, dst_rel in HTML_PAGES.items():
        src = os.path.join(ROOT, src_rel)
        if not os.path.exists(src):
            print(f"  skip (missing page): {src_rel}")
            continue
        with open(src, "r", encoding="utf-8") as f:
            text = f.read()
        basedir = basedir_for(dst_rel)
        text = rewrite_html(text, basedir)
        dst = os.path.join(TEMPLATES, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"  wrote template: {dst_rel} (basedir='{basedir}')")


if __name__ == "__main__":
    print("Copying assets -> static/")
    copy_assets()
    print("Copying pages -> templates/ (with link rewriting)")
    copy_pages()
    print("Done.")
