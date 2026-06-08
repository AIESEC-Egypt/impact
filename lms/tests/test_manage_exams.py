from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from lms.models import Academy, AcademyContentManager, Choice, Exam, Question

User = get_user_model()


class ManageExamTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(
            key="b2b",
            title="B2B Academy",
            kind=Academy.KIND_ACADEMY,
            is_published=True,
        )
        self.user = User.objects.create_user(
            username="expa_99",
            password="x",
            expa_id="99",
        )
        AcademyContentManager.objects.create(
            academy=self.academy,
            expa_id="99",
        )

    def test_manager_can_create_exam_and_question(self):
        self.client.force_login(self.user)
        create_url = reverse("lms:manage_exam_create", args=["b2b"])
        response = self.client.post(
            create_url,
            {
                "title": "B2B onboarding quiz",
                "description": "Test your knowledge",
                "pass_mark": 70,
                "time_limit_minutes": 0,
                "max_attempts": 0,
                "questions_per_attempt": 0,
                "is_published": True,
            },
        )
        self.assertEqual(response.status_code, 302)
        exam = Exam.objects.get(academy=self.academy, title="B2B onboarding quiz")
        self.assertEqual(exam.kind, Exam.KIND_EXAM)

        q_url = reverse("lms:manage_exam_questions", args=["b2b", exam.pk])
        response = self.client.post(
            q_url,
            {
                "text": "What is B2B?",
                "question_type": Question.SINGLE,
                "points": 1,
                "order": 1,
                "choices-TOTAL_FORMS": 4,
                "choices-INITIAL_FORMS": 0,
                "choices-MIN_NUM_FORMS": 2,
                "choices-MAX_NUM_FORMS": 1000,
                "choices-0-text": "Business to Business",
                "choices-0-is_correct": "on",
                "choices-0-order": 1,
                "choices-1-text": "Back to Basics",
                "choices-1-is_correct": False,
                "choices-1-order": 2,
                "choices-2-text": "",
                "choices-2-is_correct": False,
                "choices-2-order": 3,
                "choices-3-text": "",
                "choices-3-is_correct": False,
                "choices-3-order": 4,
            },
        )
        self.assertEqual(response.status_code, 302, response.content[:500])
        self.assertEqual(exam.questions.count(), 1)
        question = exam.questions.first()
        self.assertEqual(question.choices.filter(is_correct=True).count(), 1)

    def test_question_create_url_redirects_to_builder(self):
        self.client.force_login(self.user)
        exam = Exam.objects.create(
            academy=self.academy,
            title="Redirect quiz",
            kind=Exam.KIND_EXAM,
        )
        url = reverse("lms:manage_question_create", args=["b2b", exam.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        self.assertIn("#add-question", response["Location"])

    def test_other_user_cannot_create_exam(self):
        other = User.objects.create_user(username="other", password="x", expa_id="1")
        self.client.force_login(other)
        url = reverse("lms:manage_exam_create", args=["b2b"])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
