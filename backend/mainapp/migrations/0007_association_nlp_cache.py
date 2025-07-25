from django.db import migrations, models
import django.contrib.postgres.fields

class Migration(migrations.Migration):
    dependencies = [
        ('mainapp', '0006_alter_association_cipher_userprofile'),
    ]
    operations = [
        migrations.AddField(
            model_name='association',
            name='grouping_key_lemmas',
            field=models.TextField(null=True, blank=True, db_index=True),
        ),
        migrations.AddField(
            model_name='association',
            name='text_embedding_vector',
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.FloatField(), size=384, null=True, blank=True
            ),
        ),
    ] 