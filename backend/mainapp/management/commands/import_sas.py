from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
import csv
import os

from mainapp.models import Cipher, Association

User = get_user_model()

class Command(BaseCommand):
    help = 'Import SAS (Russian Associative Dictionary) dataset'

    def add_arguments(self, parser):
        parser.add_argument(
            '--ciphers-file',
            type=str,
            default='ciphers.csv',
            help='Path to ciphers CSV file'
        )
        parser.add_argument(
            '--associations-file', 
            type=str,
            default='associations.csv',
            help='Path to associations CSV file'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Batch size for bulk operations'
        )

    def handle(self, *args, **options):
        ciphers_file = options['ciphers_file']
        associations_file = options['associations_file']
        batch_size = options['batch_size']

        self.stdout.write(self.style.SUCCESS('🚀 Starting SAS import...'))

        # Проверяем файлы
        if not os.path.exists(ciphers_file):
            self.stdout.write(self.style.ERROR(f'❌ File not found: {ciphers_file}'))
            self.stdout.write(f'Current directory: {os.getcwd()}')
            self.stdout.write(f'Looking for: {os.path.abspath(ciphers_file)}')
            return

        if not os.path.exists(associations_file):
            self.stdout.write(self.style.ERROR(f'❌ File not found: {associations_file}'))
            self.stdout.write(f'Current directory: {os.getcwd()}')
            self.stdout.write(f'Looking for: {os.path.abspath(associations_file)}')
            return

        try:
            with transaction.atomic():
                # 1. Импорт стимулов (ciphers)
                self.stdout.write('📊 Importing stimuli...')

                cipher_objects = []
                with open(ciphers_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        cipher_objects.append(Cipher(
                            id=int(row['id']),
                            result=row['result']
                        ))

                Cipher.objects.bulk_create(cipher_objects, ignore_conflicts=True)
                self.stdout.write(self.style.SUCCESS(f'✅ Imported {len(cipher_objects)} stimuli'))

                # 2. Считаем уникальных пользователей из associations
                self.stdout.write('👥 Reading users from associations...')
                unique_users = set()

                with open(associations_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        unique_users.add(int(row['user_id']))

                # Создаем пользователей
                user_objects = []
                for user_id in unique_users:
                    user_objects.append(User(
                        username=f'sas_user_{user_id}',
                        email=f'sas_user_{user_id}@example.com',
                        is_active=True
                    ))

                User.objects.bulk_create(user_objects, ignore_conflicts=True)
                self.stdout.write(self.style.SUCCESS(f'✅ Created {len(user_objects)} users'))

                # 3. Импорт ассоциаций батчами
                self.stdout.write('🔗 Importing associations...')

                # Создаем кэш пользователей и шрифтов для быстрого доступа
                user_cache = {
                    user.username: user 
                    for user in User.objects.filter(username__startswith='sas_user_')
                }
                cipher_cache = {
                    cipher.id: cipher 
                    for cipher in Cipher.objects.all()
                }

                association_batch = []
                total_count = 0
                skipped_count = 0

                with open(associations_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)

                    for idx, row in enumerate(reader, 1):
                        try:
                            user_key = f"sas_user_{row['user_id']}"
                            cipher_id = int(row['cipher_id'])

                            if user_key not in user_cache:
                                skipped_count += 1
                                continue

                            if cipher_id not in cipher_cache:
                                skipped_count += 1
                                continue

                            association_batch.append(Association(
                                user=user_cache[user_key],
                                cipher=cipher_cache[cipher_id],
                                reaction_description=row['reaction_description'],
                                font_weight=int(row['font_weight']),
                                font_style=row['font_style'],
                                letter_spacing=int(row['letter_spacing']),
                                font_size=int(row['font_size']),
                                line_height=float(row['line_height'])
                            ))

                            # Сохраняем батч
                            if len(association_batch) >= batch_size:
                                Association.objects.bulk_create(
                                    association_batch, 
                                    ignore_conflicts=True
                                )
                                total_count += len(association_batch)
                                self.stdout.write(f'Progress: {total_count} associations imported...')
                                association_batch = []

                        except (ValueError, KeyError) as e:
                            skipped_count += 1
                            self.stdout.write(
                                self.style.WARNING(f'⚠️ Skipping row {idx}: {e}')
                            )
                            continue

                    # Сохраняем оставшиеся
                    if association_batch:
                        Association.objects.bulk_create(
                            association_batch, 
                            ignore_conflicts=True
                        )
                        total_count += len(association_batch)

                self.stdout.write(self.style.SUCCESS(f'\n✅ Import completed!'))
                self.stdout.write(f'📊 Final statistics:')
                self.stdout.write(f'   - Stimuli: {Cipher.objects.count()}')
                self.stdout.write(f'   - Users: {User.objects.filter(username__startswith="sas_user_").count()}')
                self.stdout.write(f'   - Associations: {Association.objects.count()}')
                self.stdout.write(f'   - Skipped rows: {skipped_count}')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Import failed: {str(e)}'))
            import traceback
            traceback.print_exc()
            raise
