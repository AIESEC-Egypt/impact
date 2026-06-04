from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_role_and_department_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="memberroster",
            name="committee_department",
            field=models.CharField(
                blank=True,
                help_text="EXPA committee_department.name (e.g. OGV, IGV) — LC product line.",
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name="memberroster",
            name="department_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Primary department code; prefers committee_department over function.",
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name="memberroster",
            name="department_raw",
            field=models.CharField(
                blank=True,
                help_text="EXPA function + committee, e.g. OGX - Outgoing Exchange · OGV.",
                max_length=255,
            ),
        ),
    ]
