from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from accounts.roster_quizzes import attempts_for_expa_id, quiz_progress_for_expa_id
from lms.models import Academy, Attempt, Exam

User = get_user_model()


class QuizProgressAdminTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="expa_5354503",
            expa_id="5354503",
            full_name="Mohamed Wael",
            role_code="Member",
        )
        self.dreaming = Academy.objects.create(
            key="dreaming",
            title="Dreaming Process",
            kind=Academy.KIND_DREAMING,
            is_published=True,
        )
        self.igv = Academy.objects.create(
            key="igv",
            title="iGV Academy",
            kind=Academy.KIND_ACADEMY,
            is_published=True,
        )
        self.dreaming_quiz = Exam.objects.create(
            academy=self.dreaming,
            title="AIESEC in Egypt History & Identity Assessment",
            kind=Exam.KIND_QUIZ,
            is_published=True,
            is_mandatory=False,
            pass_mark=60,
        )
        self.igv_quiz = Exam.objects.create(
            academy=self.igv,
            title="iGV onboarding quiz",
            kind=Exam.KIND_EXAM,
            is_published=True,
            is_mandatory=False,
            pass_mark=70,
        )

    def _submit_attempt(self, exam, percentage=80, passed=True):
        attempt = Attempt.objects.create(
            user=self.user,
            exam=exam,
            expa_id="5354503",
            percentage=percentage,
            passed=passed,
            submitted_at=timezone.now(),
        )
        return attempt

    def test_dreaming_attempt_visible_in_admin_profile(self):
        self._submit_attempt(self.dreaming_quiz, percentage=75, passed=True)
        progress = quiz_progress_for_expa_id(
            "5354503",
            role_code="Member",
            admin_profile=True,
        )
        titles = [row["exam"].title for row in progress["rows"]]
        self.assertIn(self.dreaming_quiz.title, titles)
        dreaming_row = next(
            row for row in progress["rows"] if row["exam"].id == self.dreaming_quiz.id
        )
        self.assertEqual(dreaming_row["percentage"], 75)
        self.assertTrue(dreaming_row["passed"])

    def test_optional_non_academy_quiz_hidden_without_admin_profile(self):
        self._submit_attempt(self.dreaming_quiz)
        progress = quiz_progress_for_expa_id(
            "5354503",
            academy_key="igv",
            role_code="Member",
            admin_profile=False,
        )
        titles = [row["exam"].title for row in progress["rows"]]
        self.assertNotIn(self.dreaming_quiz.title, titles)

    def test_attempts_linked_by_expa_id_after_new_login_user(self):
        self._submit_attempt(self.dreaming_quiz)
        second_user = User.objects.create_user(
            username="expa_5354503_old",
            expa_id="5354503",
            full_name="Mohamed Wael",
        )
        attempts = list(attempts_for_expa_id("5354503"))
        self.assertEqual(len(attempts), 1)
        self.assertEqual(attempts[0].user_id, self.user.id)
        progress = quiz_progress_for_expa_id("5354503", admin_profile=True)
        self.assertTrue(any(row["attempt"] for row in progress["rows"]))
        self.assertIsNotNone(progress["user"])
