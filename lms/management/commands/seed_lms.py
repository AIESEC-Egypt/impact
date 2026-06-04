"""Seed the academies (and the dreaming process) plus a little sample content.

Idempotent: safe to run multiple times. Run with:
    python manage.py seed_lms
"""

from django.core.management.base import BaseCommand

from lms.models import Academy, Choice, Exam, Material, Question, Session

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
    help = "Seed academies, the dreaming process, and sample learning content."

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

        self._seed_sample_content()
        self._seed_dreaming_quiz(dreaming)
        self.stdout.write(self.style.SUCCESS("Seeding complete."))

    def _seed_sample_content(self):
        igv = Academy.objects.get(key="igv")

        Material.objects.get_or_create(
            academy=igv,
            title="iGV Starter Pack",
            defaults={
                "material_type": "ppt",
                "url": "https://docs.google.com/presentation/d/EXAMPLE/edit",
                "description": "Everything a new iGV member needs to get started.",
                "order": 1,
            },
        )
        Session.objects.get_or_create(
            academy=igv,
            title="iGV 101 Recording",
            defaults={
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "description": "Recorded onboarding session for iGV.",
                "order": 1,
            },
        )

        exam, created = Exam.objects.get_or_create(
            academy=igv,
            title="iGV Knowledge Check",
            defaults={
                "description": "A short quiz on iGV fundamentals.",
                "kind": Exam.KIND_EXAM,
                "pass_mark": 60,
                "max_attempts": 0,
                "is_published": True,
            },
        )
        if created or not exam.questions.exists():
            q1 = Question.objects.create(
                exam=exam,
                text="What does iGV stand for?",
                question_type=Question.SINGLE,
                points=1,
                order=1,
            )
            Choice.objects.create(question=q1, text="Incoming Global Volunteer", is_correct=True, order=1)
            Choice.objects.create(question=q1, text="International Group Visit", is_correct=False, order=2)
            Choice.objects.create(question=q1, text="Internal Growth Vision", is_correct=False, order=3)

            q2 = Question.objects.create(
                exam=exam,
                text="iGV opportunities are always 6 weeks long.",
                question_type=Question.TRUE_FALSE,
                points=1,
                order=2,
            )
            Choice.objects.create(question=q2, text="True", is_correct=False, order=1)
            Choice.objects.create(question=q2, text="False", is_correct=True, order=2)

            q3 = Question.objects.create(
                exam=exam,
                text="Which of these are stages of the customer journey? (select all)",
                question_type=Question.MULTIPLE,
                points=2,
                order=3,
            )
            Choice.objects.create(question=q3, text="Attraction", is_correct=True, order=1)
            Choice.objects.create(question=q3, text="Consideration", is_correct=True, order=2)
            Choice.objects.create(question=q3, text="Hibernation", is_correct=False, order=3)
        self.stdout.write("Seeded sample material/session/exam on iGV.")

    def _seed_dreaming_quiz(self, dreaming):
        from django.core.management import call_command

        call_command("seed_dreaming_history_quiz")
        self.stdout.write("Seeded dreaming history quiz (60 questions, 15 per attempt).")
