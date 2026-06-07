"""Copy legacy asset folders from the project root into static/ for Django + WhiteNoise."""

import shutil
from pathlib import Path

from django.core.management.base import BaseCommand
from django.conf import settings

# (source relative to BASE_DIR, dest relative to static/)
def _video_src(base: Path) -> Path | None:
    for name in ("Middle Video", "Middel Video"):
        p = base / name
        if p.exists():
            return p
    return None


SYNC_PATHS = [
    ("fonts", "fonts"),
    ("AiE", "AiE"),
    ("aspects", "aspects"),
    ("image", "image"),
    ("Academy/pdf", "Academy/pdf"),
    ("Academy/img", "Academy/img"),
    ("Academy/fonts", "Academy/fonts"),
    ("Academy/style.css", "Academy/style.css"),
]


class Command(BaseCommand):
    help = "Sync fonts/, AiE/, Middel Video/, Academy/ assets into static/."

    def handle(self, *args, **options):
        base = Path(settings.BASE_DIR)
        static = base / "static"
        static.mkdir(parents=True, exist_ok=True)
        copied = 0
        skipped = 0

        video_src = _video_src(base)
        if video_src:
            dest = static / "Middel Video"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(
                video_src,
                dest,
                dirs_exist_ok=True,
                ignore=shutil.ignore_patterns(
                    ".vscode", ".git", "__pycache__", "*.pdf"
                ),
            )
            count = sum(1 for _ in dest.rglob("*") if _.is_file())
            self.stdout.write(
                f"Copied dir {video_src.name} → static/Middel Video ({count} files)"
            )

        for src_rel, dest_rel in SYNC_PATHS:
            src = base / src_rel
            dest = static / dest_rel
            if not src.exists():
                self.stdout.write(self.style.WARNING(f"Skip (missing): {src_rel}"))
                skipped += 1
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            if src.is_dir():
                shutil.copytree(
                    src,
                    dest,
                    dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns(
                        ".vscode", ".git", "__pycache__", "*.pdf"
                    ),
                )
                count = sum(1 for _ in dest.rglob("*") if _.is_file())
                self.stdout.write(f"Copied dir {src_rel} → static/{dest_rel} ({count} files)")
            else:
                shutil.copy2(src, dest)
                self.stdout.write(f"Copied file {src_rel} → static/{dest_rel}")
            copied += 1

        removed_pdfs = 0
        for pdf in static.rglob("*.pdf"):
            if pdf.is_file():
                pdf.unlink()
                removed_pdfs += 1
        if removed_pdfs:
            self.stdout.write(f"Removed {removed_pdfs} PDF file(s) from static/")

        self.stdout.write(
            self.style.SUCCESS(f"Done. {copied} paths synced, {skipped} missing.")
        )
