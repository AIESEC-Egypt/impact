"""Sync current EXPA member positions into MemberRoster (from EDM membership-extract flow).

Usage:
    python manage.py sync_expa_members

Requires Expa member sync configuration in admin (GIS access token + Egypt MC office_id),
or environment variables EXPA_SYNC_ACCESS_TOKEN and EXPA_SYNC_OFFICE_ID.
"""

from django.core.management.base import BaseCommand

from accounts.expa_roster_sync import describe_sync_config, get_sync_config, sync_roster_from_expa


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
        parser.add_argument(
            "--use-admin",
            action="store_true",
            help="Use EXPA member sync configuration from Django admin instead of env vars.",
        )

    def handle(self, *args, **options):
        _source, detail = describe_sync_config(prefer_admin=options["use_admin"])
        self.stdout.write(f"Using EXPA sync config ({detail})")
        config, _source = get_sync_config(prefer_admin=options["use_admin"])
        if not config:
            self.stderr.write(
                self.style.ERROR(
                    "No EXPA sync config. Set EXPA_SYNC_ACCESS_TOKEN + EXPA_SYNC_OFFICE_ID "
                    "in Coolify, or add EXPA member sync configuration in admin."
                )
            )
            return
        self.stdout.write("Syncing EXPA member roster…")
        try:
            result = sync_roster_from_expa(
                config=config,
                deactivate_missing=not options["keep_stale"],
                enrich_missing_committee=options["enrich_missing_committee"],
            )
        except Exception as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            if "401" in str(exc):
                self.stderr.write(
                    self.style.WARNING(
                        "401 Unauthorized — check EXPA_SYNC_ACCESS_TOKEN in Coolify "
                        "(no quotes/spaces) or update Admin → EXPA member sync configuration. "
                        "Run with --use-admin to force the admin row."
                    )
                )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Fetched {result['fetched']} positions, "
                f"{result['people']} people — "
                f"created {result['created']}, updated {result['updated']}, "
                f"deactivated {result['deactivated']}."
            )
        )
