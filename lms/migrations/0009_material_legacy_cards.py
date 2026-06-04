from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lms", "0008_homepromo"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="card_image",
            field=models.CharField(
                blank=True,
                help_text="Static card graphic, e.g. Academy/pdf/Phone call.svg",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="material",
            name="pdf_filename",
            field=models.CharField(
                blank=True,
                help_text="Opens /static/Academy/pdf/<name>.pdf when set (legacy academy decks).",
            ),
        ),
        migrations.AddField(
            model_name="material",
            name="section_group",
            field=models.CharField(
                blank=True,
                help_text="Section heading on the academy page (e.g. Consideration, IRs).",
                max_length=120,
            ),
        ),
        migrations.AlterField(
            model_name="material",
            name="url",
            field=models.URLField(
                blank=True, max_length=500, verbose_name="Drive / resource link"
            ),
        ),
    ]
