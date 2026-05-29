# 📋 GroupBoard — Kanban для учебной группы

**🌐 Live Demo: https://front-production-be05.up.railway.app**

Веб-приложение для организации учёбы: домашние задания, расписание, очередь выступлений, голосования и канбан-доска.

## 🚀 Быстрый старт (Docker Compose — 1 команда)

```bash
docker compose up --build
```

После запуска:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Swagger Docs**: http://localhost:8000/docs

## 🛠 Разработка без Docker

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate  # или venv\Scripts\activate на Windows
pip install -r requirements.txt

# Настройте .env
cp .env.example .env  # отредактируйте DATABASE_URL

uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🧪 Тесты
```bash
cd backend
pip install aiosqlite  # для тестовой БД
pytest tests/ -v
```

## 🔧 Стек
| Слой | Технология |
|------|-----------|
| Backend | Python 3.12 + FastAPI + SQLAlchemy |
| База данных | PostgreSQL 16 |
| Frontend | React 18 + TypeScript + TailwindCSS |
| Auth | JWT (python-jose + bcrypt) |
| CI/CD | GitHub Actions |
| Деплой | Docker Compose / Render + Vercel |

## 📦 Структура проекта
```
groupboard/
├── backend/
│   ├── app/
│   │   ├── api/routes/   # auth, groups, homework, queues, ...
│   │   ├── core/         # config, security (JWT)
│   │   ├── db/           # session, Base
│   │   ├── models/       # SQLAlchemy models
│   │   └── schemas/      # Pydantic schemas
│   ├── tests/            # pytest tests
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/        # LoginPage, DashboardPage, BoardPage, ...
│       ├── components/   # UI components
│       ├── store/        # Zustand (authStore)
│       └── lib/          # axios api client
└── docker-compose.yml
```

## 🎮 Геймификация (баллы)
| Действие | Баллы |
|----------|-------|
| Выполнить ДЗ | +10 |
| Завершить задачу | +15 |
| Записаться в очередь | +5 |
| Проголосовать | +2 |

## 👥 Роли
- **admin** — полный доступ, управление пользователями
- **head** — староста: создание очередей, задач, расписания
- **member** — студент: просмотр, отметка ДЗ, голосования

## 🌐 Деплой (Railway)

Проект задеплоен на [Railway](https://railway.app) из монорепозитория:

| Сервис | URL |
|--------|-----|
| Frontend | https://front-production-be05.up.railway.app |
| Backend | Railway (private) |
| Database | PostgreSQL (Railway plugin) |

Конфигурация деплоя в `backend/railway.toml` и `frontend/railway.toml`.  
Переменные окружения: `DATABASE_URL`, `SECRET_KEY`, `VITE_API_URL`.

## 📝 Лицензия
MIT — учебный проект
