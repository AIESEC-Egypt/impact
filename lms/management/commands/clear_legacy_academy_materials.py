"""Remove auto-imported legacy academy cards (not added via /manage/)."""

from django.core.management.base import BaseCommand

from lms.models import Material


class Command(BaseCommand):
    help = "Delete materials imported from legacy Academy/*.html (have card_image set)."

    def handle(self, *args, **options):
        legacy = Material.objects.exclude(card_image="")
        count = legacy.count()
        deleted, _ = legacy.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Removed {deleted} legacy material row(s) ({count} matched)."
            )
        )
