from django.test import TestCase

from lms.models import Academy, Material
from lms.views import academy_context


class AcademyMaterialsVisibilityTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(
            key="b2b",
            title="B2B Academy",
            is_published=True,
        )

    def test_admin_material_with_empty_card_image_is_visible(self):
        Material.objects.create(
            academy=self.academy,
            title="BD academy",
            url="https://drive.google.com/drive/folders/example",
            is_published=True,
            card_image="",
        )
        self.assertEqual(academy_context(self.academy)["materials"].count(), 1)

    def test_legacy_import_with_card_image_is_hidden(self):
        Material.objects.create(
            academy=self.academy,
            title="B2B ACADEMY",
            card_image="Academy/pdf/Phone call.svg",
            is_published=True,
        )
        self.assertEqual(academy_context(self.academy)["materials"].count(), 0)

    def test_legacy_row_with_drive_url_is_visible(self):
        Material.objects.create(
            academy=self.academy,
            title="BD academy",
            card_image="Academy/pdf/_BD academy.svg",
            url="https://drive.google.com/drive/folders/example",
            is_published=True,
        )
        self.assertEqual(academy_context(self.academy)["materials"].count(), 1)

    def test_unpublished_material_is_hidden(self):
        Material.objects.create(
            academy=self.academy,
            title="Draft",
            url="https://drive.google.com/drive/folders/example",
            is_published=False,
            card_image="",
        )
        self.assertEqual(academy_context(self.academy)["materials"].count(), 0)

    def test_url_normalized_on_save(self):
        material = Material.objects.create(
            academy=self.academy,
            title="Drive folder",
            url="drive.google.com/drive/folders/example",
            is_published=True,
        )
        self.assertEqual(
            material.url,
            "https://drive.google.com/drive/folders/example",
        )
