from django.db import migrations, models


def rename_mxp_to_tm(apps, schema_editor):
    Academy = apps.get_model("lms", "Academy")
    Academy.objects.filter(key="mxp").update(
        key="tm",
        title="TM Academy",
        subtitle="Talent Management",
    )
    MemberRoster = apps.get_model("accounts", "MemberRoster")
    MemberRoster.objects.filter(academy_key="mxp").update(academy_key="tm")
    User = apps.get_model("accounts", "User")
    User.objects.filter(academy_key="mxp").update(academy_key="tm")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_memberroster_committee_department"),
        ("lms", "0003_material_subtitle"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="is_mandatory",
            field=models.BooleanField(
                default=False,
                help_text="If set, members are expected to pass this quiz (enforced in admin/roster tracking).",
            ),
        ),
        migrations.RunPython(rename_mxp_to_tm, migrations.RunPython.noop),
    ]
