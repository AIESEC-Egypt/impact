from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_update_profile_endpoint"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="academy_key",
            field=models.CharField(
                blank=True,
                help_text="Functional academy slug from EDM roster (ogv, igv, …).",
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="function_code",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="user",
            name="function_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.CreateModel(
            name="ExpaMemberSyncConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="EXPA member sync", max_length=100, unique=True)),
                ("access_token", models.CharField(help_text="GIS API token (from EXPA admin/network tab). Not the OAuth client secret.", max_length=500)),
                ("graphql_url", models.URLField(default="https://gis-api.aiesec.org/graphql")),
                ("office_id", models.PositiveIntegerField(help_text="AIESEC in Egypt MC office id in EXPA (filters memberPositions).")),
                ("date_from", models.DateField(blank=True, help_text="Position start date filter (from).", null=True)),
                ("date_to", models.DateField(blank=True, help_text="Position start date filter (to).", null=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "EXPA member sync configuration",
                "verbose_name_plural": "EXPA member sync configuration",
            },
        ),
        migrations.CreateModel(
            name="MemberRoster",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("expa_id", models.CharField(db_index=True, max_length=64, unique=True)),
                ("full_name", models.CharField(blank=True, max_length=255)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("role_name", models.CharField(blank=True, max_length=255)),
                ("function_code", models.CharField(blank=True, max_length=50)),
                ("function_name", models.CharField(blank=True, max_length=255)),
                ("function_raw", models.CharField(blank=True, max_length=255)),
                ("academy_key", models.CharField(blank=True, db_index=True, help_text="Mapped functional academy: ogv, igv, ogt, igt, b2c, b2b, mxp, fl.", max_length=40)),
                ("home_lc_name", models.CharField(blank=True, max_length=255)),
                ("member_position_id", models.CharField(blank=True, max_length=64)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("last_synced_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "EXPA member (roster)",
                "verbose_name_plural": "EXPA member roster",
                "ordering": ["full_name", "expa_id"],
            },
        ),
    ]
