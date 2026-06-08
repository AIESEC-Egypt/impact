"""Reset apps whose migrations were recorded without creating core tables."""

from django.core.management.base import BaseCommand
from django.db import connection

# (app_label, sentinel_table) — if migrations exist but sentinel is missing, reset the app.
GHOST_CHECKS = (
    ("accounts", "accounts_user"),
    ("lms", "lms_academy"),
)


class Command(BaseCommand):
    help = (
        "Detect ghost migration state (django_migrations rows without real tables) "
        "and reset affected apps so migrate can run cleanly."
    )

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            tables = set(connection.introspection.table_names())

            for app, sentinel in GHOST_CHECKS:
                if sentinel in tables:
                    continue

                cursor.execute(
                    "SELECT 1 FROM django_migrations WHERE app = %s LIMIT 1",
                    [app],
                )
                if not cursor.fetchone():
                    continue

                self.stdout.write(
                    self.style.WARNING(
                        f"Ghost migrations for {app}: {sentinel} missing — "
                        f"dropping {app}_* tables and clearing migration history"
                    )
                )

                prefix = f"{app}_"
                for table in sorted(tables):
                    if table.startswith(prefix):
                        cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
                        self.stdout.write(f"  dropped {table}")
                        tables.discard(table)

                cursor.execute("DELETE FROM django_migrations WHERE app = %s", [app])
                self.stdout.write(f"  cleared django_migrations for {app}")
