#!/bin/bash

echo "📤 Экспорт данных из базы данных..."

# Проверяем, что контейнер базы данных запущен
if ! docker-compose ps db | grep -q "Up"; then
    echo "❌ Контейнер базы данных не запущен. Запускаем..."
    docker-compose up -d db
    sleep 15
fi

# Создаем директорию для экспорта
mkdir -p data

# Экспортируем данные
echo "🔄 Экспорт данных..."
docker-compose exec -T db pg_dump -U postgres -d fontanalysis -F c -b -v -f /tmp/export.dump

# Копируем дамп из контейнера
docker cp $(docker-compose ps -q db):/tmp/export.dump data/fontanalysis_export.dump

# Также создаем SQL дамп для совместимости
docker-compose exec -T db pg_dump -U postgres -d fontanalysis -f /tmp/export.sql
docker cp $(docker-compose ps -q db):/tmp/export.sql data/fontanalysis_export.sql

# Экспортируем фикстуры Django
echo "🔄 Экспорт Django фикстур..."
docker-compose exec backend python manage.py dumpdata --indent 2 > data/django_fixtures.json

echo "✅ Данные экспортированы в директорию data/:"
echo "   - data/fontanalysis_export.dump (бинарный дамп PostgreSQL)"
echo "   - data/fontanalysis_export.sql (SQL дамп)"
echo "   - data/django_fixtures.json (Django фикстуры)"
