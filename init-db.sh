#!/bin/bash

echo "🚀 Инициализация базы данных для новых разработчиков..."

# Проверяем, что контейнер базы данных запущен
if ! docker-compose ps db | grep -q "Up"; then
    echo "❌ Контейнер базы данных не запущен. Запускаем..."
    docker-compose up -d db
    sleep 15
fi

# Ждем готовности базы данных
echo "⏳ Ожидание готовности базы данных..."
sleep 10

# Создаем суперпользователя Django
echo "👤 Создание суперпользователя Django..."
docker-compose exec -T db psql -U postgres -d fontanalysis -c "
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth_user WHERE username = 'admin') THEN
        INSERT INTO auth_user (username, email, first_name, last_name, is_staff, is_superuser, is_active, date_joined, password)
        VALUES ('admin', 'admin@example.com', 'Admin', 'User', true, true, true, NOW(), 'pbkdf2_sha256\$260000\$dummy\$dummy');
    END IF;
END
\$\$;
"

# Создаем тестовые данные
echo "📊 Создание тестовых данных..."
docker-compose exec -T db psql -U postgres -d fontanalysis -c "
-- Создаем тестовые шифры
INSERT INTO mainapp_cipher (result) VALUES 
('Тест 1'), ('Тест 2'), ('Тест 3')
ON CONFLICT (result) DO NOTHING;

-- Создаем тестовые реакции
INSERT INTO mainapp_reaction (name, description) VALUES 
('Радость', 'Положительная эмоция'), 
('Грусть', 'Отрицательная эмоция'),
('Удивление', 'Нейтральная эмоция')
ON CONFLICT (name) DO NOTHING;

-- Создаем тестового администратора
INSERT INTO mainapp_administrator (user_id) 
SELECT id FROM auth_user WHERE username = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- Создаем тестовый граф
INSERT INTO mainapp_graph (cipher_count, administrator_id) 
SELECT 3, id FROM mainapp_administrator LIMIT 1
ON CONFLICT (administrator_id) DO NOTHING;
"

echo "✅ База данных инициализирована!"
echo "📋 Доступные данные:"
echo "   - Суперпользователь: admin / admin"
echo "   - Тестовые шифры: 3 штуки"
echo "   - Тестовые реакции: 3 штуки"
echo "   - Тестовый граф: 1 штука"
