"""Merge duplicate Academy rows (e.g. key B2B) into the canonical lowercase slug (b2b)."""

from django.core.management.base import BaseCommand
from django.db import transaction

from lms.models import Academy

# Wrong key -> canonical key (same function academy).
MERGE_MAP = {
    "B2B": "b2b",
    "B2b": "b2b",
    "BD": "bd",
    "OGV": "ogv",
    "IGV": "igv",
    "OGT": "ogt",
    "IGT": "igt",
    "B2C": "b2c",
    "TM": "tm",
    "FL": "fl",
    "MXP": "tm",
}


class Command(BaseCommand):
    help = "Move materials/sessions/exams from duplicate academy keys to canonical slugs."

    def handle(self, *args, **options):
        merged = 0
        with transaction.atomic():
            for wrong_key, canonical_key in MERGE_MAP.items():
                wrong = Academy.objects.filter(key=wrong_key).first()
                if not wrong:
                    continue
                canonical, _ = Academy.objects.get_or_create(
                    key=canonical_key,
                    defaults={
                        "title": wrong.title,
                        "subtitle": wrong.subtitle,
                        "kind": wrong.kind,
                        "is_published": wrong.is_published,
                        "order": wrong.order,
                        "template_name": "",
                    },
                )
                for rel in ("materials", "sessions", "exams", "content_managers"):
                    count = getattr(wrong, rel).update(academy=canonical)
                    if count:
                        self.stdout.write(
                            f"  {wrong_key} → {canonical_key}: moved {count} {rel}"
                        )
                wrong.delete()
                merged += 1
                self.stdout.write(self.style.SUCCESS(f"Merged {wrong_key} into {canonical_key}"))

        if not merged:
            self.stdout.write("No duplicate academies found.")
        else:
            self.stdout.write(self.style.SUCCESS(f"Done. Merged {merged} duplicate(s)."))
