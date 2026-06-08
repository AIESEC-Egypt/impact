"""Convert YouTube / Google Drive watch links into iframe-safe embed URLs."""

import re
from urllib.parse import parse_qs, urlparse


def _normalize_url(url):
    u = (url or "").strip()
    if not u:
        return ""
    if not re.match(r"^https?://", u, re.I):
        u = f"https://{u.lstrip('/')}"
    return u


def youtube_video_id(url):
    """Extract an 11-char YouTube video id from common share/watch URLs."""
    u = _normalize_url(url)
    if not u:
        return None

    parsed = urlparse(u)
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]

    if host == "youtu.be":
        vid = parsed.path.lstrip("/").split("/")[0].split("?")[0]
        return vid if _valid_youtube_id(vid) else None

    if host not in ("youtube.com", "youtube-nocookie.com", "m.youtube.com"):
        return None

    path = parsed.path or ""
    if path.startswith("/watch"):
        vid = (parse_qs(parsed.query).get("v") or [None])[0]
        return vid if _valid_youtube_id(vid) else None
    for prefix in ("/embed/", "/shorts/", "/v/", "/live/"):
        if path.startswith(prefix):
            vid = path[len(prefix) :].split("/")[0].split("?")[0]
            return vid if _valid_youtube_id(vid) else None
    return None


def _valid_youtube_id(vid):
    return bool(vid and re.fullmatch(r"[A-Za-z0-9_-]{11}", vid))


def youtube_embed_url(url, origin=None):
    vid = youtube_video_id(url)
    if not vid:
        return ""
    params = ["rel=0", "modestbranding=1", "playsinline=1"]
    if origin:
        params.append(f"origin={origin}")
    return f"https://www.youtube.com/embed/{vid}?{'&'.join(params)}"


def drive_preview_url(url):
    u = _normalize_url(url)
    if not u or "drive.google.com/file/d/" not in u:
        return ""
    if "/preview" in u:
        return u
    base = u.split("/view")[0].rstrip("/")
    file_id = ""
    match = re.search(r"/file/d/([^/]+)", base)
    if match:
        file_id = match.group(1)
    if file_id:
        return f"https://drive.google.com/file/d/{file_id}/preview"
    return f"{base}/preview"


def video_embed_url(url, origin=None):
    """Return an iframe src for YouTube or Google Drive video links."""
    u = _normalize_url(url)
    if not u:
        return ""

    yt = youtube_embed_url(u, origin=origin)
    if yt:
        return yt

    drive = drive_preview_url(u)
    if drive:
        return drive

    parsed = urlparse(u)
    if parsed.netloc and "youtube" in parsed.netloc.lower():
        return u

    return u
