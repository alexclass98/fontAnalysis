# Используем официальный образ Python
FROM python:3.9-slim

# Устанавливаем системные зависимости для компиляции пакетов
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файл зависимостей
COPY requirements.txt .

# Обновляем pip
RUN pip install --upgrade pip

# Устанавливаем проблемные пакеты отдельно
RUN pip install --no-cache-dir gevent

# Устанавливаем остальные Python зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальные файлы проекта
COPY . .

# Создаем директорию для статических файлов
RUN mkdir -p staticfiles

# Собираем статические файлы
RUN python manage.py collectstatic --noinput

# Открываем порт
EXPOSE 8000

# Команда запуска
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "--keep-alive", "5", "fontAnalysis.wsgi:application"]
