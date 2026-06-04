from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_member_roster"),
    ]

    operations = [
        migrations.RenameField(
            model_name="user",
            old_name="function_code",
            new_name="department_code",
        ),
        migrations.RenameField(
            model_name="user",
            old_name="function_name",
            new_name="department_name",
        ),
        migrations.AddField(
            model_name="user",
            name="role_code",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="user",
            name="role_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RenameField(
            model_name="memberroster",
            old_name="function_code",
            new_name="department_code",
        ),
        migrations.RenameField(
            model_name="memberroster",
            old_name="function_name",
            new_name="department_name",
        ),
        migrations.RenameField(
            model_name="memberroster",
            old_name="function_raw",
            new_name="department_raw",
        ),
        migrations.AddField(
            model_name="memberroster",
            name="role_code",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="memberroster",
            name="role_raw",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="memberroster",
            name="department_code",
            field=models.CharField(blank=True, db_index=True, max_length=50),
        ),
        migrations.AlterField(
            model_name="memberroster",
            name="department_raw",
            field=models.CharField(
                blank=True,
                help_text="Raw EXPA function field, e.g. OGX - Outgoing Exchange or OGT.",
                max_length=255,
            ),
        ),
        migrations.AlterField(
            model_name="memberroster",
            name="academy_key",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Academy from department: ogv, igv, ogt, igt, b2c, b2b, mxp, fl.",
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="department_code",
            field=models.CharField(
                blank=True,
                help_text="EXPA department code (OGX, OGT, ICX, …).",
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="department_name",
            field=models.CharField(
                blank=True,
                help_text="EXPA department full name (Outgoing Exchange, …).",
                max_length=255,
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="academy_key",
            field=models.CharField(
                blank=True,
                help_text="Academy slug mapped from department (ogv, ogt, …).",
                max_length=40,
            ),
        ),
    ]
