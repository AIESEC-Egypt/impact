from django.db import migrations, models


def backfill_attempt_expa_ids(apps, schema_editor):
    Attempt = apps.get_model("lms", "Attempt")
    User = apps.get_model("accounts", "User")
    user_expa = {
        uid: eid
        for uid, eid in User.objects.exclude(expa_id="").values_list("id", "expa_id")
    }
    for attempt in Attempt.objects.filter(expa_id="").iterator():
        expa_id = user_expa.get(attempt.user_id, "")
        if expa_id:
            attempt.expa_id = expa_id
            attempt.save(update_fields=["expa_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0010_exam_show_correct_answers_after_pass"),
        ("accounts", "0005_memberroster_committee_department"),
    ]

    operations = [
        migrations.AddField(
            model_name="attempt",
            name="expa_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="EXPA person ID at submit time — used to link attempts across logins.",
                max_length=64,
            ),
        ),
        migrations.RunPython(backfill_attempt_expa_ids, migrations.RunPython.noop),
    ]
