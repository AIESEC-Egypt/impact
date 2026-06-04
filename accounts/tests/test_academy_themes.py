from django.test import SimpleTestCase

from lms.academy_themes import get_academy_theme


class AcademyThemeTests(SimpleTestCase):
    def test_ogv_red_theme_class(self):
        theme = get_academy_theme("ogv")
        self.assertEqual(theme["label"], "oGV")
        self.assertEqual(theme["theme_class"], "academy-hero--ogv")

    def test_fl_label(self):
        theme = get_academy_theme("fl")
        self.assertEqual(theme["label"], "F&L")

    def test_unknown_key_fallback(self):
        theme = get_academy_theme("unknown")
        self.assertEqual(theme["theme_class"], "academy-hero--default")
