from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from lms.manage_access import can_manage_academy, managed_academies_queryset
from lms.models import Academy, AcademyContentManager

User = get_user_model()


class ManageAccessTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(
            key="ogv",
            title="oGV Academy",
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
            label="MCVP OGV",
        )

    def test_manager_can_open_dashboard(self):
        self.client.force_login(self.user)
        url = reverse("lms:manage_dashboard", args=["ogv"])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_other_user_denied(self):
        other = User.objects.create_user(username="other", password="x", expa_id="1")
        self.client.force_login(other)
        response = self.client.get(reverse("lms:manage_dashboard", args=["ogv"]))
        self.assertEqual(response.status_code, 302)

    def test_managed_academies_queryset(self):
        qs = managed_academies_queryset(self.user)
        self.assertEqual(list(qs), [self.academy])
        self.assertTrue(can_manage_academy(self.user, self.academy))
