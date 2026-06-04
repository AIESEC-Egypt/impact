"""
Django management command template: print members who logged in via EXPA OAuth.

Usage (add to your app as management/commands/list_logged_in_members.py):

    python manage.py list_logged_in_members
    python manage.py list_logged_in_members --json
"""
import json
from django.core.management.base import BaseCommand

# Copy functions from models-snippet.py into this command, or:
from general.models import ExpaAuthIdentity


def identity_to_dict(identity):
    ep = identity.expa_person
    person = ep.person if ep else None
    return {
        "expa_id": identity.expa_id,
        "username": identity.user.username if identity.user_id else None,
        "full_name": str(person) if person else None,
        "last_login_at": identity.updated_at.isoformat() if identity.updated_at else None,
    }


class Command(BaseCommand):
    help = "List ExpaAuthIdentity rows (users who completed EXPA OAuth login)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")
        parser.add_argument("--limit", type=int, default=50)

    def handle(self, *args, **options):
        qs = (
            ExpaAuthIdentity.objects.select_related("user", "expa_person", "expa_person__person")
            .order_by("-updated_at")[: options["limit"]]
        )
        rows = [identity_to_dict(i) for i in qs]
        if options["json"]:
            self.stdout.write(json.dumps(rows, indent=2, default=str))
            return
        for row in rows:
            self.stdout.write(
                f"{row['expa_id']}\t{row['full_name']}\t{row['username']}\t{row['last_login_at']}"
            )
