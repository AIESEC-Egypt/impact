"""Reset apps whose migrations were recorded without creating core tables."""

from django.core.management.base import BaseCommand
from django.db import connection

# admin has no table prefix; only django_admin_log is app-specific.
ADMIN_TABLES = ("django_admin_log",)

# When accounts_user is missing, admin/lms migrations must be cleared too or migrate fails
# with InconsistentMigrationHistory (admin depends on accounts.0001_initial).
ACCOUNTS_CLUSTER_APPS = ("accounts", "admin", "lms")


class Command(BaseCommand):
    help = (
        "Detect ghost migration state (django_migrations rows without real tables) "
        "and reset affected apps so migrate can run cleanly."
    )

    def _app_has_migrations(self, cursor, app):
        cursor.execute(
            "SELECT 1 FROM django_migrations WHERE app = %s LIMIT 1",
            [app],
        )
        return bool(cursor.fetchone())

    def _drop_tables(self, cursor, tables, names):
        for table in sorted(names):
            if table not in tables:
                continue
            cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
            self.stdout.write(f"  dropped {table}")
            tables.discard(table)

    def _clear_migrations(self, cursor, apps):
        for app in apps:
            cursor.execute("DELETE FROM django_migrations WHERE app = %s", [app])
            self.stdout.write(f"  cleared django_migrations for {app}")

    def _reset_accounts_cluster(self, cursor, tables):
        self.stdout.write(
            self.style.WARNING(
                "Ghost migrations for accounts cluster: accounts_user missing — "
                "resetting accounts, admin, and lms"
            )
        )
        self._drop_tables(
            cursor,
            tables,
            [t for t in tables if t.startswith("accounts_") or t.startswith("lms_")]
            + [t for t in ADMIN_TABLES if t in tables],
        )
        self._clear_migrations(cursor, ACCOUNTS_CLUSTER_APPS)

    def _reset_lms(self, cursor, tables):
        self.stdout.write(
            self.style.WARNING(
                "Ghost migrations for lms: lms_academy missing — "
                "dropping lms_* tables and clearing migration history"
            )
        )
        self._drop_tables(cursor, tables, [t for t in tables if t.startswith("lms_")])
        self._clear_migrations(cursor, ("lms",))

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            tables = set(connection.introspection.table_names())

            if "accounts_user" not in tables:
                if any(self._app_has_migrations(cursor, app) for app in ACCOUNTS_CLUSTER_APPS):
                    self._reset_accounts_cluster(cursor, tables)

            elif "lms_academy" not in tables and self._app_has_migrations(cursor, "lms"):
                self._reset_lms(cursor, tables)
