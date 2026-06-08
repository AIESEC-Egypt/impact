from django.test import TestCase
from django.urls import reverse

from lms.models import Academy


class AcademyRoutingTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(
            key="b2b",
            title="B2B Academy",
            is_published=True,
        )

    def test_get_absolute_url(self):
        self.assertEqual(self.academy.get_absolute_url(), "/academy/b2b/")

    def test_key_saved_lowercase(self):
        academy = Academy(title="Sample", key="SaMpLe", is_published=True)
        academy.save()
        self.assertEqual(academy.key, "sample")

    def test_uppercase_url_redirects_to_canonical(self):
        self.client.force_login(
            __import__("django.contrib.auth", fromlist=["get_user_model"]).get_user_model().objects.create_user(
                username="tester",
                password="x",
            )
        )
        resp = self.client.get("/academy/B2B/", follow=False)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp["Location"], "/academy/b2b/")
