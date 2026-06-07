"""Seed academies and the dreaming process (no legacy material cards).

Idempotent: safe to run multiple times. Run with:
    python manage.py seed_lms
"""

from django.core.management.base import BaseCommand

from lms.models import Academy

ACADEMIES = [
    ("ogv", "oGV Academy", "Outgoing Global Volunteer", 1),
    ("igv", "iGV Academy", "Incoming Global Volunteer", 2),
    ("ogt", "oGT Academy", "Outgoing Global Talent / Teacher", 3),
    ("igt", "iGT Academy", "Incoming Global Talent / Teacher", 4),
    ("b2c", "B2C Academy", "Business to Customer", 5),
    ("b2b", "B2B Academy", "Business to Business", 6),
    ("tm", "TM Academy", "Talent Management", 7),
    ("fl", "F&L Academy", "Finance & Legal", 8),
]


class Command(BaseCommand):
    help = "Seed academies and the dreaming process."

    def handle(self, *args, **options):
        for key, title, subtitle, order in ACADEMIES:
            academy, created = Academy.objects.update_or_create(
                key=key,
                defaults={
                    "title": title,
                    "subtitle": subtitle,
                    "template_name": "",
                    "kind": Academy.KIND_ACADEMY,
                    "order": order,
                    "is_published": True,
                },
            )
            self.stdout.write(("Created " if created else "Updated ") + title)

        dreaming, _ = Academy.objects.update_or_create(
            key="dreaming",
            defaults={
                "title": "Dreaming Process",
                "subtitle": "El Haweya - Belong, Act, Influence",
                "template_name": "dreaming.html",
                "kind": Academy.KIND_DREAMING,
                "order": 99,
                "is_published": True,
            },
        )
        self.stdout.write("Created/updated Dreaming Process")

        self._seed_dreaming_quiz(dreaming)
        self.stdout.write(self.style.SUCCESS("Seeding complete."))

    def _seed_dreaming_quiz(self, dreaming):
        from django.core.management import call_command

        call_command("seed_dreaming_history_quiz")
        self.stdout.write("Seeded dreaming history quiz (30 questions, 15 per attempt).")
