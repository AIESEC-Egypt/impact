from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from lms.exam_respondents import (
    HAWEYA_EXAM_TITLE,
    exam_respondents_payload,
    respondents_for_exam,
    resolve_haweya_exam,
)
from lms.models import Academy, AcademyContentManager, Attempt, Exam, Question

User = get_user_model()


class RespondentsHelperTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(
            key="dreaming",
            title="Dreaming",
            kind=Academy.KIND_DREAMING,
        )
        self.exam = Exam.objects.create(
            academy=self.academy,
            title=HAWEYA_EXAM_TITLE,
            kind=Exam.KIND_QUIZ,
            is_published=True,
        )
        self.q = Question.objects.create(
            exam=self.exam,
            text="Q1",
            points=1,
            order=1,
        )
        self.user_a = User.objects.create_user(
            username="alice",
            expa_id="1001",
            full_name="Alice Example",
            email="alice@example.com",
        )
        self.user_b = User.objects.create_user(
            username="bob",
            expa_id="1002",
            full_name="Bob Example",
            email="bob@example.com",
        )

    def _submit(self, user, percentage, passed, hours_ago=0):
        att = Attempt.objects.create(
            user=user,
            exam=self.exam,
            expa_id=user.expa_id,
            score=percentage,
            max_score=100,
            percentage=percentage,
            passed=passed,
            submitted_at=timezone.now() - timezone.timedelta(hours=hours_ago),
        )
        return att

    def test_best_attempt_per_member(self):
        self._submit(self.user_a, 40, False, hours_ago=2)
        self._submit(self.user_a, 80, True, hours_ago=1)
        self._submit(self.user_b, 55, False)

        rows = respondents_for_exam(self.exam)
        self.assertEqual(len(rows), 2)
        by_expa = {r["expa_id"]: r for r in rows}
        self.assertEqual(by_expa["1001"]["percentage"], 80)
        self.assertTrue(by_expa["1001"]["passed"])
        self.assertEqual(by_expa["1001"]["attempt_count"], 2)
        self.assertEqual(by_expa["1002"]["percentage"], 55)

    def test_resolve_haweya_exam(self):
        self.assertEqual(resolve_haweya_exam().pk, self.exam.pk)

    def test_payload_shape(self):
        self._submit(self.user_a, 90, True)
        payload = exam_respondents_payload(self.exam)
        self.assertEqual(payload["total_respondents"], 1)
        self.assertEqual(payload["exam"]["academy_key"], "dreaming")
        self.assertEqual(payload["respondents"][0]["full_name"], "Alice Example")


@override_settings(QUIZ_EXPORT_API_TOKEN="test-export-secret")
class ExportApiTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(key="dreaming", title="Dreaming", kind=Academy.KIND_DREAMING)
        self.exam = Exam.objects.create(
            academy=self.academy,
            title=HAWEYA_EXAM_TITLE,
            kind=Exam.KIND_QUIZ,
        )
        self.user = User.objects.create_user(username="u1", expa_id="42", full_name="Test User")
        Attempt.objects.create(
            user=self.user,
            exam=self.exam,
            expa_id="42",
            percentage=70,
            passed=True,
            submitted_at=timezone.now(),
        )

    def test_haweya_export_requires_token(self):
        url = reverse("lms:export_haweya_respondents")
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_haweya_export_with_bearer_token(self):
        url = reverse("lms:export_haweya_respondents")
        response = self.client.get(url, HTTP_AUTHORIZATION="Bearer test-export-secret")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_respondents"], 1)
        self.assertIn("exported_at", data)

    def test_exam_export_by_id(self):
        url = reverse("lms:export_exam_respondents") + f"?exam_id={self.exam.pk}"
        response = self.client.get(url, HTTP_AUTHORIZATION="Bearer test-export-secret")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["exam"]["id"], self.exam.pk)


class ManageRespondentsUiTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(
            key="b2b",
            title="B2B",
            kind=Academy.KIND_ACADEMY,
            is_published=True,
        )
        self.manager = User.objects.create_user(username="mgr", expa_id="77", is_staff=False)
        AcademyContentManager.objects.create(academy=self.academy, expa_id="77")
        self.exam = Exam.objects.create(
            academy=self.academy,
            title="Quiz",
            kind=Exam.KIND_EXAM,
            is_published=True,
        )
        Question.objects.create(exam=self.exam, text="Q?", order=1, points=1)
        respondent = User.objects.create_user(
            username="resp",
            expa_id="88",
            full_name="Respondent One",
        )
        Attempt.objects.create(
            user=respondent,
            exam=self.exam,
            expa_id="88",
            percentage=100,
            passed=True,
            submitted_at=timezone.now(),
        )

    def test_manage_exam_questions_shows_respondents(self):
        self.client.force_login(self.manager)
        url = reverse("lms:manage_exam_questions", args=["b2b", self.exam.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Members who answered")
        self.assertContains(response, "Respondent One")

    def test_site_admin_can_open_dreaming_haweya_quiz(self):
        dreaming = Academy.objects.create(key="dreaming", title="Dreaming", kind=Academy.KIND_DREAMING)
        haweya = Exam.objects.create(
            academy=dreaming,
            title=HAWEYA_EXAM_TITLE,
            kind=Exam.KIND_QUIZ,
        )
        admin = User.objects.create_user(username="admin", is_staff=True, is_superuser=True)
        self.client.force_login(admin)
        url = reverse("lms:manage_exam_questions", args=["dreaming", haweya.pk])
        self.assertEqual(self.client.get(url).status_code, 200)
