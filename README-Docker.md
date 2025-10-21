# Docker Setup для FontAnalysis

## Быстрый старт

### 🚀 Для новых разработчиков (рекомендуется)

1. **Клонируйте репозиторий:**

   ```bash
   git clone <your-repo-url>
   cd fontAnalysis
   ```

2. **Скопируйте файл окружения:**

   ```bash
   cp env.example .env
   ```

3. **Запустите проект (данные загрузятся автоматически):**

   ```bash
   docker-compose up --build
   ```

4. **Откройте приложение:**
   - Фронтенд: http://localhost:3000
   - API: http://localhost:8000
   - Админка: http://localhost:8000/admin (admin/admin)

### 🔄 Для работы с реальными данными

1. **Экспорт данных с продакшена:**

   ```bash
   ./export-data.sh
   ```

2. **Импорт данных на новую машину:**

   ```bash
   ./import-data.sh
   ```

3. **Запуск проекта:**
   ```bash
   docker-compose up --build
   ```

### 🛠️ Дополнительные команды

- **Загрузка тестовых данных:** `./load-fixtures.sh`
- **Инициализация БД:** `./init-db.sh`
- **Экспорт данных:** `./export-data.sh`
- **Импорт данных:** `./import-data.sh`

## Структура Docker-конфигурации

### Сервисы:

- **db** - PostgreSQL база данных
- **backend** - Django API сервер
- **frontend** - React приложение (обслуживается через Nginx)

### Порты:

- 3000 - React фронтенд
- 8000 - Django API
- 5432 - PostgreSQL (только для разработки)

## Полезные команды

### Разработка:

```bash
# Запуск в фоне
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Пересборка
docker-compose up --build
```

### Управление базой данных:

```bash
# Создание суперпользователя Django
docker-compose exec backend python manage.py createsuperuser

# Выполнение миграций
docker-compose exec backend python manage.py migrate

# Сбор статических файлов
docker-compose exec backend python manage.py collectstatic
```

### Отладка:

```bash
# Вход в контейнер бэкенда
docker-compose exec backend bash

# Вход в контейнер базы данных
docker-compose exec db psql -U postgres -d fontanalysis

# Просмотр логов конкретного сервиса
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
```

## Переменные окружения

Основные переменные в `.env`:

- `SECRET_KEY` - секретный ключ Django (ОБЯЗАТЕЛЬНО измените в продакшене!)
- `DEBUG` - режим отладки (1/0)
- `DATABASE_URL` - строка подключения к БД
- `CORS_ALLOWED_ORIGINS` - разрешенные домены для CORS
- `REACT_APP_API_URL` - URL API для фронтенда

## Производственное развертывание

Для продакшена:

1. Измените `DEBUG=0` в `.env`
2. Установите надежный `SECRET_KEY`
3. Настройте `DATABASE_URL` для вашей БД
4. Обновите `CORS_ALLOWED_ORIGINS` и `CSRF_TRUSTED_ORIGINS`
5. Рассмотрите использование внешней БД вместо контейнера

## Troubleshooting

### Проблемы с базой данных:

```bash
# Сброс базы данных
docker-compose down -v
docker-compose up --build
```

### Проблемы с зависимостями:

```bash
# Пересборка без кэша
docker-compose build --no-cache
```

### Проблемы с портами:

Убедитесь, что порты 3000, 8000, 5432 свободны:

```bash
lsof -i :3000
lsof -i :8000
lsof -i :5432
```
