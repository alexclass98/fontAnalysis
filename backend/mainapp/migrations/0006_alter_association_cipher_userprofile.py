# Generated by Django 4.2.20 on 2025-05-19 10:51

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('mainapp', '0005_association_reaction_lemmas'),
    ]

    operations = [
        migrations.AlterField(
            model_name='association',
            name='cipher',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cipher_associations', to='mainapp.cipher'),
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('gender', models.CharField(blank=True, choices=[('MALE', 'Мужской'), ('FEMALE', 'Женский'), ('OTHER', 'Другой'), ('PNS', 'Предпочитаю не указывать')], max_length=10, null=True)),
                ('age', models.PositiveIntegerField(blank=True, null=True)),
                ('education_level', models.CharField(blank=True, choices=[('SECONDARY', 'Среднее'), ('VOCATIONAL', 'Среднее специальное'), ('INCOMPLETE_HIGHER', 'Незаконченное высшее'), ('BACHELOR', 'Бакалавр'), ('MASTER', 'Магистр'), ('SPECIALIST', 'Специалитет'), ('PHD', 'Кандидат/Доктор наук (PhD)'), ('OTHER_EDU', 'Другое'), ('PNS_EDU', 'Предпочитаю не указывать')], max_length=20, null=True)),
                ('specialty', models.CharField(blank=True, help_text="Например, 'Психолог', 'Инженер', 'Студент-филолог'", max_length=255, null=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
