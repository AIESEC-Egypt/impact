from django.test import SimpleTestCase

from accounts.function_mapping import (
    department_from_expa_fields,
    parse_expa_function,
    resolve_academy_key,
)


class FunctionMappingTests(SimpleTestCase):
    def test_ogx_maps_ogv(self):
        self.assertEqual(resolve_academy_key("OGX - Outgoing Exchange"), "ogv")

    def test_icx_maps_igv(self):
        self.assertEqual(resolve_academy_key("ICX - Incoming Exchange"), "igv")

    def test_fin_maps_fl(self):
        self.assertEqual(resolve_academy_key("FIN - Finance"), "fl")

    def test_ogt_only_code_maps_ogt(self):
        self.assertEqual(resolve_academy_key("OGT"), "ogt")

    def test_committee_department_ogv_maps_ogv_academy(self):
        dept = department_from_expa_fields(
            "OGX - Outgoing Exchange",
            "OGV",
        )
        self.assertEqual(dept["department_code"], "OGV")
        self.assertEqual(dept["academy_key"], "ogv")

    def test_parse_position_tm_ogx_ogv_committee(self):
        from accounts.expa_roster_sync import _parse_position_row

        parsed = _parse_position_row({
            "role_name": "TM",
            "department_raw": "OGX - Outgoing Exchange",
            "committee_department_raw": "OGV",
        })
        self.assertEqual(parsed["role_code"], "TM")
        self.assertEqual(parsed["department_code"], "OGV")
        self.assertEqual(parsed["academy_key"], "ogv")

    def test_department_from_profile_uses_latest_active_start(self):
        from accounts.profile_department import department_from_profile

        profile = {
            "member_positions": [
                {
                    "function": {"name": "OGX - Outgoing Exchange"},
                    "role": {"name": "Member"},
                    "start_date": "2024-01-01",
                    "end_date": "2025-01-01",
                    "status": "completed",
                },
                {
                    "function": {"name": "OGT"},
                    "role": {"name": "TM"},
                    "start_date": "2025-06-01",
                    "end_date": "2026-06-01",
                    "status": "active",
                },
            ],
        }
        inferred = department_from_profile(profile)
        self.assertEqual(inferred["department_code"], "OGT")
        self.assertEqual(inferred["role_code"], "TM")
        self.assertEqual(inferred["academy_key"], "ogt")

    def test_pick_best_row_prefers_active_latest_start(self):
        from accounts.expa_roster_sync import _pick_best_row

        rows = [
            {
                "department_raw": "FIN - Finance",
                "role_name": "ESTL",
                "start_date": "2025-05-04",
                "end_date": "2025-08-04",
                "status": "completed",
            },
            {
                "department_raw": "OD - Organisational Development/Expansions",
                "role_name": "MCVP",
                "start_date": "2025-08-01",
                "end_date": "2026-08-01",
                "status": "active",
            },
        ]
        picked = _pick_best_row(rows)
        self.assertEqual(picked["role_name"], "MCVP")
        self.assertEqual(picked["department_raw"], "OD - Organisational Development/Expansions")

    def test_department_from_profile_prefers_active_mcvp(self):
        from accounts.profile_department import department_from_profile

        profile = {
            "member_positions": [
                {
                    "function": {"name": "FIN - Finance"},
                    "role": {"name": "ESTL"},
                    "start_date": "2025-05-04",
                    "end_date": "2025-08-04",
                    "status": "completed",
                },
                {
                    "function": {"name": "OD - Organisational Development/Expansions"},
                    "role": {"name": "MCVP"},
                    "start_date": "2025-08-01",
                    "end_date": "2026-08-01",
                    "status": "active",
                },
            ],
        }
        inferred = department_from_profile(profile)
        self.assertEqual(inferred["role_code"], "MCVP")
        self.assertEqual(inferred["department_code"], "OD")

    def test_role_and_department_split_for_sync_row(self):
        from accounts.expa_roster_sync import _parse_position_row

        member_ogt = _parse_position_row({"role_name": "Member", "department_raw": "OGT"})
        self.assertEqual(member_ogt["role_code"], "Member")
        self.assertEqual(member_ogt["department_code"], "OGT")
        self.assertEqual(member_ogt["academy_key"], "ogt")

        tm_ogx = _parse_position_row(
            {"role_name": "TM", "department_raw": "OGX - Outgoing Exchange"}
        )
        self.assertEqual(tm_ogx["role_code"], "TM")
        self.assertEqual(tm_ogx["department_code"], "OGX")
        self.assertEqual(tm_ogx["academy_key"], "ogv")

    def test_tm_department_maps_tm_academy(self):
        self.assertEqual(resolve_academy_key("TM - Talent Management"), "tm")
        self.assertEqual(resolve_academy_key("MXP"), "tm")
        dept = department_from_expa_fields("OGX - Outgoing Exchange", "OGV")
        self.assertEqual(dept["academy_key"], "ogv")

    def test_parse_code_dash_name(self):
        self.assertEqual(parse_expa_function("MKT - Marketing"), ("MKT", "Marketing"))
