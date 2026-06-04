from django.db import migrations

LEGACY_TEMPLATES = [
    "Academy/oGV.html",
    "Academy/iGV.html",
    "Academy/oGT.html",
    "Academy/iGT.html",
    "Academy/B2C.html",
    "Academy/B2B.html",
    "Academy/MXP.html",
    "Academy/F&L.html",
]


def forwards(apps, schema_editor):
    Academy = apps.get_model("lms", "Academy")
    Academy.objects.filter(template_name__in=LEGACY_TEMPLATES).update(template_name="")


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
