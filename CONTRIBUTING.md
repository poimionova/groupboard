# Правила работы с Git — GroupBoard

## Ветвление (Git Flow)

```
main          → продакшн, всегда рабочий код
develop       → основная ветка разработки
feature/*     → новая функциональность
fix/*         → исправление багов
docs/*        → только документация
```

### Схема работы

```
main
 └── develop
      ├── feature/homework-module
      ├── feature/queue-algorithm
      ├── fix/jwt-token-expiry
      └── docs/api-documentation
```

### Команды

```bash
# Начать новую фичу
git checkout develop
git pull origin develop
git checkout -b feature/название-фичи

# Завершить фичу
git add .
git commit -m "feat: описание что сделано"
git push origin feature/название-фичи
# → создать Pull Request в develop

# Релиз в main
git checkout main
git merge develop
git tag v0.1.0
git push origin main --tags
```

---

## Conventional Commits

Формат сообщения коммита:

```
<тип>(<область>): <описание>
```

### Типы коммитов

| Тип | Когда использовать | Пример |
|-----|-------------------|--------|
| `feat` | Новая функциональность | `feat(homework): add deadline notifications` |
| `fix` | Исправление бага | `fix(auth): fix token expiry bug` |
| `docs` | Только документация | `docs: update README setup guide` |
| `style` | Форматирование, отступы | `style: fix linting errors` |
| `refactor` | Рефакторинг без новых фич | `refactor(queue): simplify distribution algorithm` |
| `test` | Добавление тестов | `test(auth): add login endpoint tests` |
| `chore` | Сборка, зависимости, CI | `chore: update requirements.txt` |
| `ci` | Изменения в CI/CD | `ci: add pytest to GitHub Actions` |

### Примеры коммитов проекта

```bash
git commit -m "feat(auth): add JWT registration and login"
git commit -m "feat(homework): add completion tracking with points"
git commit -m "feat(queue): implement auto-distribution algorithm"
git commit -m "feat(polls): add anonymous voting support"
git commit -m "fix(groups): fix invite code generation"
git commit -m "test(auth): add 5 unit tests for auth endpoints"
git commit -m "ci: configure GitHub Actions pipeline"
git commit -m "docs: add deployment guide to README"
git commit -m "chore: add Docker Compose configuration"
```

### Правила

- Описание **на английском** или русском — главное единообразие
- Описание начинается **со строчной буквы**
- Без точки в конце
- Длина строки — не более 72 символов

---

## Версионирование (SemVer)

```
v MAJOR . MINOR . PATCH
    │       │       └── исправление бага
    │       └── новая функциональность (обратно совместимо)
    └── ломающее изменение API
```

Примеры тегов проекта:
```bash
git tag v0.1.0   # первый рабочий прототип
git tag v0.2.0   # добавлен модуль очередей
git tag v1.0.0   # финальная сдача проекта
```

---

## Создать первый тег

```bash
git tag v0.1.0 -m "feat: initial working prototype"
git push origin v0.1.0
```
