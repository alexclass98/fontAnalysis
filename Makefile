.PHONY: help build up down restart logs clean init export import fixtures

# Показать справку
help:
	@echo "🚀 FontAnalysis Docker Commands"
	@echo ""
	@echo "Основные команды:"
	@echo "  make up          - Запустить проект"
	@echo "  make down        - Остановить проект"
	@echo "  make restart     - Перезапустить проект"
	@echo "  make logs        - Показать логи"
	@echo "  make clean       - Очистить все контейнеры и volumes"
	@echo ""
	@echo "Инициализация:"
	@echo "  make init        - Инициализировать БД с тестовыми данными"
	@echo "  make fixtures    - Загрузить Django фикстуры"
	@echo ""
	@echo "Данные:"
	@echo "  make export      - Экспортировать данные"
	@echo "  make import      - Импортировать данные"
	@echo ""
	@echo "Разработка:"
	@echo "  make build       - Пересобрать образы"
	@echo "  make shell       - Войти в контейнер бэкенда"

# Основные команды
up:
	docker-compose up --build

down:
	docker-compose down

restart: down up

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	docker system prune -f

# Инициализация
init:
	./init-db.sh

fixtures:
	./load-fixtures.sh

# Данные
export:
	./export-data.sh

import:
	./import-data.sh

# Разработка
build:
	docker-compose build --no-cache

shell:
	docker-compose exec backend bash

# Полная инициализация для новых разработчиков
setup: build up init
	@echo "✅ Проект готов к работе!"
	@echo "🌐 Откройте http://localhost:3000"
