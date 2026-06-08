from django.db import migrations, models

LEGACY = "https://gis-api.aiesec.org/v2/people/me"
CURRENT = "https://gis-api.aiesec.org/v2/current_person"


def _table_exists(schema_editor, table_name):
    return table_name in schema_editor.connection.introspection.table_names()


def ensure_expa_oauth_table(apps, schema_editor):
    """Repair DBs where 0001 was recorded but the table was never created."""
    model = apps.get_model("accounts", "ExpaOAuthConfig")
    if _table_exists(schema_editor, model._meta.db_table):
        return
    schema_editor.create_model(model)


def update_profile_endpoint(apps, schema_editor):
    model = apps.get_model("accounts", "ExpaOAuthConfig")
    if not _table_exists(schema_editor, model._meta.db_table):
        return
    model.objects.filter(people_me_url=LEGACY).update(people_me_url=CURRENT)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(ensure_expa_oauth_table, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="expaoauthconfig",
            name="people_me_url",
            field=models.URLField(default=CURRENT),
            preserve_default=False,
        ),
        migrations.RunPython(update_profile_endpoint, migrations.RunPython.noop),
    ]
