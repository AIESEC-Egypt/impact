"""Import materials from legacy Academy/*.html into the database."""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from lms.legacy_academy_parser import load_legacy_academy_materials
from lms.models import Academy, Material


class Command(BaseCommand):
    help = "Parse legacy Academy HTML and seed Material rows (card images + Drive links)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing materials for each academy before import.",
        )

    def handle(self, *args, **options):
        base = Path(settings.BASE_DIR)
        parsed = load_legacy_academy_materials(base)
        if not parsed:
            self.stderr.write(
                "No Academy/*.html found at project root. Add Academy/ folder first."
            )
            return

        total = 0
        for key, items in parsed.items():
            academy = Academy.objects.filter(key=key).first()
            if not academy:
                self.stdout.write(self.style.WARNING(f"Skip {key}: academy not in DB"))
                continue
            if options["replace"]:
                deleted, _ = academy.materials.all().delete()
                self.stdout.write(f"  {key}: removed {deleted} old materials")
            for item in items:
                url = item.get("url") or ""
                if url.startswith("/static/"):
                    url = ""
                Material.objects.update_or_create(
                    academy=academy,
                    title=item["title"],
                    defaults={
                        "section_group": item.get("section_group", ""),
                        "card_image": item.get("card_image", ""),
                        "pdf_filename": "",
                        "url": url,
                        "material_type": "drive" if url else "link",
                        "order": item["order"],
                        "is_published": True,
                    },
                )
                total += 1
            self.stdout.write(f"  {key}: {len(items)} materials")

        self.stdout.write(self.style.SUCCESS(f"Seeded {total} materials from legacy HTML."))
