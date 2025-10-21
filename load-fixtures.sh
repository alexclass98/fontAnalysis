#!/bin/bash

echo "📦 Загрузка тестовых данных из фикстур..."

# Проверяем, что контейнеры запущены
if ! docker-compose ps backend | grep -q "Up"; then
    echo "❌ Контейнер бэкенда не запущен. Запускаем..."
    docker-compose up -d backend
    sleep 10
fi

# Загружаем фикстуры
echo "🔄 Загрузка фикстур..."
docker-compose exec backend python manage.py loaddata fixtures/initial_data.json

if [ $? -eq 0 ]; then
    echo "✅ Фикстуры успешно загружены!"
    echo "📋 Доступные данные:"
    echo "   - Суперпользователь: admin / admin"
    echo "   - Тестовые шифры: 3 штуки"
    echo "   - Тестовые реакции: 3 штуки"
    echo "   - Тестовый граф: 1 штука"
else
    echo "❌ Ошибка при загрузке фикстур"
    exit 1
fi
