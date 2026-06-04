from django.db import migrations, models

LEGACY = "https://gis-api.aiesec.org/v2/people/me"
CURRENT = "https://gis-api.aiesec.org/v2/current_person"


def forwards(apps, schema_editor):
    ExpaOAuthConfig = apps.get_model("accounts", "ExpaOAuthConfig")
    ExpaOAuthConfig.objects.filter(people_me_url=LEGACY).update(people_me_url=CURRENT)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="expaoauthconfig",
            name="people_me_url",
            field=models.URLField(default=CURRENT),
            preserve_default=False,
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
