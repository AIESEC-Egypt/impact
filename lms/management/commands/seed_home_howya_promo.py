"""Create a default home promo for the Dreaming Howya / history certificate quiz."""

from django.core.management.base import BaseCommand

from lms.models import Academy, Exam, HomePromo

DEFAULT_TITLE = "Obtain your Howya certificate now"
DEFAULT_SUBTITLE = (
    "Pass the El Haweya knowledge test on the Dreaming process to earn your certificate."
)
DEFAULT_BUTTON = "Take the certificate test"


class Command(BaseCommand):
    help = "Seed the default Howya certificate promo on the home page (idempotent)."

    def handle(self, *args, **options):
        dreaming = Academy.objects.filter(key="dreaming").first()
        if not dreaming:
            self.stderr.write("Run: python manage.py seed_lms")
            return

        exam = (
            Exam.objects.filter(
                academy=dreaming,
                kind=Exam.KIND_QUIZ,
                is_published=True,
            )
            .order_by("-id")
            .first()
        )

        promo, created = HomePromo.objects.get_or_create(
            title=DEFAULT_TITLE,
            defaults={
                "subtitle": DEFAULT_SUBTITLE,
                "button_label": DEFAULT_BUTTON,
                "destination": HomePromo.DEST_DREAMING_EXAM,
                "exam": exam,
                "order": 0,
                "is_published": True,
            },
        )
        if not created and exam and not promo.exam_id:
            promo.exam = exam
            promo.destination = HomePromo.DEST_DREAMING_EXAM
            promo.save(update_fields=["exam", "destination"])

        status = "Created" if created else "Already exists"
        self.stdout.write(
            self.style.SUCCESS(
                f"{status}: {promo.title}"
                + (f" → exam id {exam.id}" if exam else " (no quiz found — link exam in admin)")
            )
        )
