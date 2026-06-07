"""Remove PDF links from all Material rows (DB cleanup after PDF deprecation)."""

from django.core.management.base import BaseCommand
from django.db.models import Q

from lms.models import Material


class Command(BaseCommand):
    help = "Clear pdf_filename and strip PDF URLs from materials."

    def handle(self, *args, **options):
        cleared_names = Material.objects.exclude(pdf_filename="").update(pdf_filename="")
        pdf_urls = Material.objects.filter(
            Q(url__iendswith=".pdf")
            | Q(url__icontains="/Academy/pdf/")
            | Q(url__icontains="/static/Academy/pdf/")
        )
        cleared_urls = pdf_urls.update(url="")
        pdf_type = Material.objects.filter(material_type="pdf").update(material_type="link")

        self.stdout.write(
            self.style.SUCCESS(
                f"Cleared pdf_filename on {cleared_names} rows, "
                f"removed PDF url on {cleared_urls} rows, "
                f"reset material_type on {pdf_type} rows."
            )
        )
