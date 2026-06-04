"""Sync current EXPA member positions into MemberRoster (from EDM membership-extract flow).

Usage:
    python manage.py sync_expa_members

Requires Expa member sync configuration in admin (GIS access token + Egypt MC office_id),
or environment variables EXPA_SYNC_ACCESS_TOKEN and EXPA_SYNC_OFFICE_ID.
"""

from django.core.management.base import BaseCommand

from accounts.expa_roster_sync import sync_roster_from_expa


class Command(BaseCommand):
    help = "Fetch member positions from EXPA GraphQL and update the member roster."

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep-stale",
            action="store_true",
            help="Do not deactivate roster rows missing from this sync.",
        )
        parser.add_argument(
            "--enrich-missing-committee",
            action="store_true",
            help=(
                "Fetch memberPosition(id) for each row missing committee_department "
                "(one HTTP call per person — very slow; bulk sync already includes it)."
            ),
        )

    def handle(self, *args, **options):
        self.stdout.write("Syncing EXPA member roster…")
        try:
            result = sync_roster_from_expa(
                deactivate_missing=not options["keep_stale"],
                enrich_missing_committee=options["enrich_missing_committee"],
            )
        except Exception as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Fetched {result['fetched']} positions, "
                f"{result['people']} people — "
                f"created {result['created']}, updated {result['updated']}, "
                f"deactivated {result['deactivated']}."
            )
        )
