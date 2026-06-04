from django.test import TestCase

from accounts.roster_quizzes import mandatory_completion_summary, quiz_progress_for_expa_id
from lms.models import Academy, Exam
from lms.role_layers import canonical_member_layer, exam_is_mandatory_for


class MandatoryLayerTests(TestCase):
    def setUp(self):
        self.academy = Academy.objects.create(key="igv", title="iGV", kind=Academy.KIND_ACADEMY)
        self.exam = Exam.objects.create(
            academy=self.academy,
            title="Layer quiz",
            kind=Exam.KIND_EXAM,
            is_published=True,
            mandatory_layers=["TM", "LCVP"],
        )

    def test_canonical_middle_manager(self):
        self.assertEqual(canonical_member_layer("Middle Manager"), "MM")
        self.assertEqual(canonical_member_layer("", "Middle Manager"), "MM")

    def test_mandatory_only_for_selected_layers(self):
        self.assertTrue(exam_is_mandatory_for(self.exam, "TM"))
        self.assertTrue(exam_is_mandatory_for(self.exam, "LCVP"))
        self.assertFalse(exam_is_mandatory_for(self.exam, "Member"))
        self.assertFalse(exam_is_mandatory_for(self.exam, "MCVP"))

    def test_mandatory_for_all_when_flag_without_layers(self):
        self.exam.mandatory_layers = []
        self.exam.is_mandatory = True
        self.exam.save()
        self.assertTrue(exam_is_mandatory_for(self.exam, "Member"))
        self.assertTrue(exam_is_mandatory_for(self.exam, "TM"))

    def test_roster_summary_counts_by_layer(self):
        summary_tm = mandatory_completion_summary(
            "999", role_code="TM", role_name="Teamster"
        )
        self.assertEqual(summary_tm["mandatory_total"], 1)

        summary_member = mandatory_completion_summary(
            "999", role_code="Member", role_name="Member"
        )
        self.assertEqual(summary_member["mandatory_total"], 0)
