#!/bin/bash
set -e

# Ждем пока PostgreSQL запустится
until psql -U "$POSTGRES_USER" -c '\q'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done


# Восстанавливаем базу данных из бекапа
psql -U "$POSTGRES_USER" -d render_local_db_restored -f /backup/backup_2110251.sql

