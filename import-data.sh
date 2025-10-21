#!/bin/bash

echo "📥 Импорт данных в базу данных..."

# Проверяем наличие файлов данных
if [ ! -f "data/fontanalysis_export.dump" ] && [ ! -f "data/fontanalysis_export.sql" ]; then
    echo "❌ Файлы данных не найдены в директории data/"
    echo "   Доступные варианты:"
    echo "   1. Запустить ./export-data.sh для создания файлов данных"
    echo "   2. Использовать ./load-fixtures.sh для загрузки тестовых данных"
    exit 1
fi

# Проверяем, что контейнер базы данных запущен
if ! docker-compose ps db | grep -q "Up"; then
    echo "❌ Контейнер базы данных не запущен. Запускаем..."
    docker-compose up -d db
    sleep 15
fi

# Очищаем базу данных
echo "🧹 Очистка базы данных..."
docker-compose exec -T db psql -U postgres -d fontanalysis -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
"

# Импортируем данные
if [ -f "data/fontanalysis_export.dump" ]; then
    echo "📥 Импорт бинарного дампа..."
    docker cp data/fontanalysis_export.dump $(docker-compose ps -q db):/tmp/import.dump
    docker-compose exec -T db pg_restore -U postgres -d fontanalysis -v /tmp/import.dump
elif [ -f "data/fontanalysis_export.sql" ]; then
    echo "📥 Импорт SQL дампа..."
    docker cp data/fontanalysis_export.sql $(docker-compose ps -q db):/tmp/import.sql
    docker-compose exec -T db psql -U postgres -d fontanalysis -f /tmp/import.sql
fi

echo "✅ Данные успешно импортированы!"
