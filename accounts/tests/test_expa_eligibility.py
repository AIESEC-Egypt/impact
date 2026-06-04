from datetime import date, timedelta

from django.test import SimpleTestCase, TestCase, override_settings

from accounts.models import MemberRoster
from accounts.expa_oauth import (
    ExpaConfig,
    evaluate_eligibility,
    has_active_position,
    position_is_active,
)


def _config():
    return ExpaConfig(
        client_id="x",
        client_secret="y",
        auth_url="",
        token_url="",
        people_me_url="",
        redirect_uri="",
        allowed_entities=["egypt"],
        require_active_member=True,
    )


@override_settings(EXPA_USE_MEMBER_ROSTER=False)
class ExpaEligibilityTests(SimpleTestCase):
    def test_member_position_active_status(self):
        profile = {
            "home_mc": {"name": "AIESEC in Egypt"},
            "member_positions": [{"status": "active", "office": {"name": "Cairo"}}],
        }
        self.assertTrue(has_active_position(profile))
        allowed, reason = evaluate_eligibility(profile, _config())
        self.assertTrue(allowed)
        self.assertEqual(reason, "ok")

    def test_current_positions_without_status_uses_dates(self):
        future = (date.today() + timedelta(days=30)).isoformat()
        profile = {
            "home_mc": {"name": "AIESEC in Egypt"},
            "current_positions": [
                {
                    "id": 1,
                    "start_date": "2024-01-01",
                    "end_date": future,
                    "office": {"name": "AIESEC in Egypt"},
                }
            ],
        }
        self.assertTrue(position_is_active(profile["current_positions"][0]))
        self.assertTrue(has_active_position(profile))

    def test_completed_position_not_active(self):
        profile = {
            "home_mc": {"name": "AIESEC in Egypt"},
            "member_positions": [
                {"status": "completed", "end_date": "2020-01-01"},
            ],
        }
        self.assertFalse(has_active_position(profile))

    def test_is_aiesecer_counts_as_active(self):
        profile = {
            "home_lc": {"name": "Cairo", "parent": {"name": "AIESEC in Egypt"}},
            "is_aiesecer": True,
        }
        self.assertTrue(has_active_position(profile))
        allowed, reason = evaluate_eligibility(profile, _config())
        self.assertTrue(allowed)

    def test_home_lc_parent_for_egypt_entity(self):
        profile = {
            "is_aiesecer": True,
            "home_lc": {"name": "6th October University", "parent": {"name": "AIESEC in Egypt"}},
        }
        allowed, reason = evaluate_eligibility(profile, _config())
        self.assertTrue(allowed)
        self.assertEqual(reason, "ok")


class RosterEligibilityTests(TestCase):
    def test_roster_gate_allows_matching_expa_id(self):
        MemberRoster.objects.create(
            expa_id="5354503",
            full_name="Test User",
            department_code="ICX",
            department_name="Incoming Exchange",
            academy_key="igv",
            is_active=True,
        )
        profile = {"id": 5354503, "full_name": "Test User"}
        allowed, reason = evaluate_eligibility(profile, _config())
        self.assertTrue(allowed)
        self.assertEqual(reason, "ok")

    def test_roster_gate_denies_unknown_id(self):
        MemberRoster.objects.create(
            expa_id="1",
            full_name="Other",
            is_active=True,
        )
        profile = {"id": 99999, "full_name": "Unknown"}
        allowed, reason = evaluate_eligibility(profile, _config())
        self.assertFalse(allowed)
        self.assertEqual(reason, "not_in_roster")

    def test_login_redirect_url(self):
        from accounts.member_roster import login_redirect_url, post_login_target_for_path

        MemberRoster.objects.create(
            expa_id="42",
            academy_key="ogv",
            is_active=True,
        )
        self.assertEqual(login_redirect_url("/", "42"), "/")
        self.assertEqual(login_redirect_url("/academy/ogv/", "42"), "/academy/")
        self.assertEqual(post_login_target_for_path("/academy/igt/"), "/academy/")
        self.assertEqual(post_login_target_for_path("/manage/ogv/"), "/manage/")
