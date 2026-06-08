"""Load the 30-question AIESEC in Egypt history quiz on the Dreaming academy."""

from django.core.management.base import BaseCommand
from django.db import transaction

from lms.data.aiesec_history_quiz import FORM_DESCRIPTION, QUESTIONS
from lms.models import Academy, Choice, Exam, Question

EXAM_TITLE = "AIESEC in Egypt History & Identity Assessment"
LEGACY_TITLES = ("El Haweya Knowledge Quiz",)

DESCRIPTION = (
    FORM_DESCRIPTION
    + "\n\nEach attempt shows 15 randomly selected questions from the full bank of 30."
)


class Command(BaseCommand):
    help = "Seed or refresh the Dreaming history quiz (30 questions, 15 per attempt)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing questions on this exam and reload all 30.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dreaming = Academy.objects.filter(key="dreaming").first()
        if not dreaming:
            self.stderr.write("Dreaming academy not found. Run: python manage.py seed_lms")
            return

        exam = (
            Exam.objects.filter(academy=dreaming, title=EXAM_TITLE).first()
            or Exam.objects.filter(academy=dreaming, title__in=LEGACY_TITLES).first()
        )

        if not exam:
            exam = Exam(academy=dreaming)

        exam.title = EXAM_TITLE
        exam.description = DESCRIPTION
        exam.kind = Exam.KIND_QUIZ
        exam.pass_mark = 60
        exam.questions_per_attempt = 15
        exam.shuffle_questions = True
        exam.show_correct_answers_after_pass = False
        exam.is_published = True
        exam.save()

        if exam.questions.exists():
            if options["replace"] or exam.questions.count() != len(QUESTIONS):
                deleted, _ = exam.questions.all().delete()
                self.stdout.write(f"Removed {deleted} existing question(s).")
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"Exam already has {len(QUESTIONS)} questions. "
                        "Use --replace to reload."
                    )
                )
                self._print_summary(exam)
                return

        for order, item in enumerate(QUESTIONS, start=1):
            qtype = (
                Question.MULTIPLE
                if item["type"] == "multiple"
                else Question.SINGLE
            )
            question = Question.objects.create(
                exam=exam,
                text=item["text"],
                question_type=qtype,
                points=1,
                order=order,
            )
            correct_set = set(item["correct"])
            for choice_order, label in enumerate(item["choices"], start=1):
                Choice.objects.create(
                    question=question,
                    text=label,
                    is_correct=label in correct_set,
                    order=choice_order,
                )

        self.stdout.write(self.style.SUCCESS(f"Loaded {len(QUESTIONS)} questions."))
        self._print_summary(exam)

    def _print_summary(self, exam):
        self.stdout.write(
            f"Exam: {exam.title} (id={exam.id})\n"
            f"  Questions in bank: {exam.questions.count()}\n"
            f"  Shown per attempt: {exam.questions_per_attempt}\n"
            f"  Pass mark: {exam.pass_mark}%\n"
            f"  Take URL: /academy/dreaming/exam/{exam.id}/"
        )
