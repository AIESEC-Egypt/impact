#!/usr/bin/env python3
"""Compress git-tracked images with minimal visible quality loss."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAX_DIMENSION = 2560
JPEG_QUALITY = 88
WEBP_QUALITY = 85
PNG_QUALITY = 92  # used when quantizing large PNG photos


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def git_images() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "-z", "*.jpg", "*.jpeg", "*.png", "*.webp", "*.gif"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [ROOT / p.decode() for p in out.stdout.split(b"\0") if p]


def identify(path: Path) -> tuple[int, int]:
    result = subprocess.run(
        ["magick", "identify", "-format", "%w %h\n", f"{path}[0]"],
        check=True,
        capture_output=True,
        text=True,
    )
    line = result.stdout.strip().splitlines()[0]
    w, h = line.split()
    return int(w), int(h)


def maybe_resize_args(width: int, height: int) -> list[str]:
    if width <= MAX_DIMENSION and height <= MAX_DIMENSION:
        return []
    return ["-resize", f"{MAX_DIMENSION}x{MAX_DIMENSION}>"]


def compress_file(path: Path) -> tuple[int, int]:
    before = path.stat().st_size
    ext = path.suffix.lower()
    width, height = identify(path)
    resize = maybe_resize_args(width, height)

    with tempfile.NamedTemporaryFile(
        suffix=path.suffix, dir=path.parent, delete=False
    ) as tmp:
        tmp_path = Path(tmp.name)

    try:
        if ext in {".jpg", ".jpeg"}:
            run(
                [
                    "magick",
                    str(path),
                    *resize,
                    "-strip",
                    "-interlace",
                    "Plane",
                    "-quality",
                    str(JPEG_QUALITY),
                    str(tmp_path),
                ]
            )
        elif ext == ".webp":
            if resize:
                run(
                    [
                        "magick",
                        f"{path}[0]",
                        *resize,
                        "-strip",
                        str(tmp_path.with_suffix(".png")),
                    ]
                )
                run(
                    [
                        "cwebp",
                        "-q",
                        str(WEBP_QUALITY),
                        "-m",
                        "6",
                        "-mt",
                        str(tmp_path.with_suffix(".png")),
                        "-o",
                        str(tmp_path),
                    ]
                )
                tmp_path.with_suffix(".png").unlink(missing_ok=True)
            else:
                run(
                    [
                        "cwebp",
                        "-q",
                        str(WEBP_QUALITY),
                        "-m",
                        "6",
                        "-mt",
                        str(path),
                        "-o",
                        str(tmp_path),
                    ]
                )
        elif ext == ".png":
            # Large photo PNGs benefit from light lossy compression; UI assets stay lossless.
            photo_like = width * height > 500_000 and before > 200_000
            if photo_like:
                run(
                    [
                        "magick",
                        str(path),
                        *resize,
                        "-strip",
                        "-quality",
                        str(PNG_QUALITY),
                        str(tmp_path),
                    ]
                )
            else:
                run(
                    [
                        "magick",
                        str(path),
                        *resize,
                        "-strip",
                        "-define",
                        "png:compression-level=9",
                        "-define",
                        "png:compression-filter=5",
                        str(tmp_path),
                    ]
                )
        elif ext == ".gif":
            run(
                [
                    "magick",
                    str(path),
                    "-strip",
                    "-layers",
                    "Optimize",
                    str(tmp_path),
                ]
            )
        else:
            return before, before

        after = tmp_path.stat().st_size
        if after < before:
            tmp_path.replace(path)
            return before, after
        return before, before
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        tmp_path.with_suffix(".png").unlink(missing_ok=True)


def main() -> int:
    files = git_images()
    total_before = 0
    total_after = 0
    changed = 0

    for path in sorted(files):
        if not path.is_file():
            continue
        before, after = compress_file(path)
        total_before += before
        total_after += after
        if after < before:
            changed += 1
            pct = 100 * (1 - after / before)
            print(f"{path.relative_to(ROOT)}: {before // 1024}K → {after // 1024}K ({pct:.0f}% smaller)")

    saved = total_before - total_after
    print(
        f"\n{changed}/{len(files)} files reduced. "
        f"{total_before // 1024}K → {total_after // 1024}K "
        f"(saved {saved // 1024}K, {100 * saved / total_before:.1f}%)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
