#!/bin/bash

echo "🔄 Восстановление базы данных из дампа..."

# Ждем пока база данных будет готова
echo "⏳ Ожидание готовности базы данных..."
sleep 10

# Проверяем, что контейнер базы данных запущен
if ! docker-compose ps db | grep -q "Up"; then
    echo "❌ Контейнер базы данных не запущен. Запускаем..."
    docker-compose up -d db
    sleep 15
fi

# Очищаем базу данных перед восстановлением
echo "🧹 Очистка базы данных..."
docker-compose exec -T db psql -U postgres -d fontanalysis -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
"

# Восстанавливаем данные из дампа
echo "📥 Восстановление данных из дампа..."
docker-compose exec -T db pg_restore -U postgres -d fontanalysis -v --clean --if-exists /docker-entrypoint-initdb.d/init.dump

if [ $? -eq 0 ]; then
    echo "✅ База данных успешно восстановлена!"
    echo "📊 Проверяем количество записей в основных таблицах:"
    
    # Показываем статистику
    docker-compose exec db psql -U postgres -d fontanalysis -c "
    SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC;
    "
else
    echo "❌ Ошибка при восстановлении базы данных"
    exit 1
fi

echo "🎉 Готово! Теперь можно запустить весь проект:"
echo "docker-compose up"
