# 🔨 Три в ряд, один молоток

> Telegram Mini App — головоломка «три в ряд» с прогрессом, магазином, множителями очков и глобальным рейтингом.

---

## Содержание

- [О проекте](#о-проекте)
- [Стек технологий](#стек-технологий)
- [Архитектура](#архитектура)
- [Структура репозитория](#структура-репозитория)
- [Геймплей](#геймплей)
- [API](#api)
- [Переменные окружения](#переменные-окружения)
- [Локальная разработка](#локальная-разработка)
- [Деплой через Docker](#деплой-через-docker)
- [Telegram Mini App — настройка](#telegram-mini-app--настройка)

---

## О проекте

**Three Match One Hummer** — полноценная браузерная игра «три в ряд», встроенная в Telegram как Mini App (WebApp). Игрок авторизуется через Telegram, его прогресс сохраняется на сервере. В игре есть:

- 🎮 динамическое игровое поле 6×6
- ⚡ пассивный доход, множитель очков, каскадные комбо
- 💡 подсказки и перемешивание (покупаются за очки)
- 🛒 магазин на внутреннюю валюту (donation currency)
- 🏆 глобальная таблица лидеров

---

## Стек технологий

| Слой | Технология |
|------|------------|
| Бэкенд | Go 1.23, Gin, MongoDB Driver, JWT (HS256) |
| Фронтенд | React 18, TypeScript, Vite |
| База данных | MongoDB 7 |
| Деплой | Docker, многоэтапная сборка (один контейнер) |
| Платформа | Telegram Mini App (WebApp) |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                  Docker-контейнер (app)                  │
│                                                          │
│   ┌──────────────────────────────────────────────────┐  │
│   │             Go-сервер (Gin)  :8080               │  │
│   │                                                  │  │
│   │  GET  /             → отдаёт index.html          │  │
│   │  GET  /assets/*     → статика React (Vite dist)  │  │
│   │  POST /api/auth/telegram                         │  │
│   │  GET  /api/scores/me                             │  │
│   │  POST /api/scores                                │  │
│   │  GET  /api/leaderboard                           │  │
│   │  GET  /api/shop                                  │  │
│   │  POST /api/shop/purchase                         │  │
│   │  GET  /health                                    │  │
│   └──────────────────────────────────────────────────┘  │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │ mongo://mongodb:27017
              ┌────────────▼──────────────┐
              │   MongoDB-контейнер        │
              │   (коллекции: users,       │
              │    scores, shop_items)     │
              └───────────────────────────┘
```

Сборка выполняется в **три этапа** (`Dockerfile`):
1. **web-ui-builder** — `npm ci && npm run build` → `/app/dist`
2. **api-builder** — `go build` + копирует `dist/` в `./static/`
3. **Финальный образ** (alpine) — только бинарь `server` + папка `static/`

Итоговый образ весит ~25 МБ и не содержит ни Node, ни Go toolchain.

---

## Структура репозитория

```
three-match-one-hummer/
│
├── api/                        # Go-бэкенд
│   ├── cmd/
│   │   └── server/             # точка входа (main.go)
│   ├── internal/
│   │   ├── config/             # чтение .env / переменных окружения
│   │   ├── database/           # подключение и клиент MongoDB
│   │   ├── handlers/           # HTTP-хендлеры (auth, scores, leaderboard, shop)
│   │   ├── middleware/         # JWT-аутентификация
│   │   ├── models/             # Go-структуры (User, Score, ShopItem…)
│   │   └── server/             # роутер Gin, регистрация маршрутов
│   ├── go.mod
│   └── go.sum
│
├── web-ui/                     # React-фронтенд
│   ├── public/
│   │   └── assets/             # изображения (тайлы, иконки валюты, фоновые частицы)
│   ├── src/
│   │   ├── components/         # GameBoard, HUD, Leaderboard, модалки, оверлеи
│   │   ├── hooks/              # useTelegram, useGameEngine
│   │   ├── services/           # api.ts — все HTTP-запросы к бэкенду
│   │   ├── types/              # TypeScript-интерфейсы
│   │   ├── App.tsx             # рутовый компонент, авторизация, навигация
│   │   ├── main.tsx
│   │   └── index.css           # вся стилистика (BEM, CSS-переменные)
│   ├── package.json
│   └── vite.config.ts
│
├── Dockerfile                  # многоэтапная сборка
├── docker-compose.yml          # app + mongodb
├── .env.example                # шаблон переменных окружения
├── .gitignore
└── README.md
```

---

## Геймплей

### Основные механики

| Механика | Описание |
|----------|----------|
| **Поле** | Сетка 6×6, 7 видов тайлов |
| **Ход** | Свайп (или стрелки) на любой тайл — он меняется местами с соседом |
| **Совпадение** | 3+ тайла в ряд/колонке удаляются, поле осыпается, возможен каскад |
| **Комбо** | Каждый каскад увеличивает множитель: ×1.0 → ×1.5 → ×2.0 → … |
| **Пассивный доход** | Автоматически начисляет очки каждые 5 секунд |
| **Множитель очков** | Постоянный бонус к каждому начислению, прокачивается за очки |
| **Нет ходов** | Доска автоматически перемешивается с уведомлением игроку |

### Масштабирование стоимости действий по уровням

| Действие | Формула |
|----------|---------|
| 💡 Подсказка | `10 + (уровень − 1) × 5` |
| 🔀 Замес | `30 + (уровень − 1) × 15` |
| ⚡ +Пассив | `текущий_пассив × 50` |
| 🔢 ×Множитель | `round(текущий_множитель × 50)` |

### Победа / поражение

- **Победа на уровне:** набрать `scoreTarget` очков раньше, чем закончатся ходы.
- **Поражение:** ходы исчерпаны, очки ниже цели.
- `scoreTarget` и `movesLeft` растут с каждым уровнем.

---

## API

Все защищённые маршруты требуют заголовка:
```
Authorization: tma <Telegram initData>
```

### `POST /api/auth/telegram`
Верифицирует `initData` подписью HMAC-SHA256, создаёт или обновляет пользователя в MongoDB, возвращает JWT.

**Тело запроса:**
```json
{ "initData": "<строка initData из window.Telegram.WebApp>" }
```

**Ответ:**
```json
{
  "token": "eyJ...",
  "user": {
    "telegram_id": 123456789,
    "username": "john",
    "first_name": "John",
    "last_name": "Doe",
    "avatar_url": "https://...",
    "donation_currency": 0
  }
}
```

---

### `GET /api/scores/me`
Возвращает лучший счёт и уровень текущего пользователя.

**Ответ:**
```json
{ "best_score": 42000, "best_level": 7 }
```

---

### `POST /api/scores`
Сохраняет результат сессии; обновляет рекорд, если он побит.

**Тело запроса:**
```json
{ "score": 42000, "level": 7 }
```

---

### `GET /api/leaderboard`
Топ-50 игроков по лучшему счёту.

**Ответ:** массив объектов `LeaderboardEntry` с полями `rank`, `telegram_id`, `username`, `first_name`, `best_score`, `best_level`, `avatar_url`.

---

### `GET /api/shop`
Список доступных товаров магазина.

---

### `POST /api/shop/purchase`
Купить товар за `donation_currency`.

**Тело запроса:**
```json
{ "item_id": "extra_moves_10" }
```

---

### `GET /health`
Healthcheck-эндпоинт (используется Docker и load-balancer).

---

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```dotenv
# MongoDB
MONGO_USERNAME=admin
MONGO_PASSWORD=supersecret
MONGO_DB=threematch

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdef...   # токен вашего бота из @BotFather

# Безопасность
JWT_SECRET=very-long-random-string-here   # минимум 32 символа, случайный

# Сервер
APP_PORT=8080
GIN_MODE=release   # или debug для разработки
```

> ⚠️ Никогда не коммитьте файл `.env` в репозиторий. Он уже добавлен в `.gitignore`.

---

## Локальная разработка

### Требования

- Go 1.23+
- Node.js 20+
- MongoDB 7 (локально или Docker)

### 1. Клонировать репозиторий

```bash
git clone https://github.com/<your-org>/three-match-one-hummer.git
cd three-match-one-hummer
cp .env.example .env
# отредактируйте .env
```

### 2. Запустить только MongoDB

```bash
docker compose up -d mongodb
```

### 3. Запустить Go-бэкенд

```bash
cd api
go mod tidy
go run ./cmd/server
# сервер стартует на :8080
```

### 4. Запустить React-фронтенд (с hot reload)

```bash
cd web-ui
npm install
npm run dev
# Vite dev-сервер на :5173, проксирует /api/* на :8080
```

Откройте [http://localhost:5173](http://localhost:5173).

> **Примечание:** авторизация через Telegram требует настоящего Mini App окружения. В режиме разработки приложение работает без аутентификации (пользователь будет `null`, прогресс не сохраняется на сервере).

---

## Деплой через Docker

### Быстрый старт

```bash
cp .env.example .env
# заполните .env настоящими значениями

docker compose up -d --build
```

Приложение будет доступно на `http://<ваш-сервер>:8080`.

### Сборка вручную

```bash
docker build -t three-match-one-hummer:latest .
docker run -p 8080:8080 --env-file .env three-match-one-hummer:latest
```

### Обновление без даунтайма

```bash
git pull
docker compose up -d --build
```

Docker автоматически пересобирает образ и перезапускает контейнер без потери данных MongoDB — они хранятся в named volume `match3_mongo_data`.

---

## Telegram Mini App — настройка

1. Создайте бота через [@BotFather](https://t.me/BotFather).
2. Получите `TELEGRAM_BOT_TOKEN` и добавьте в `.env`.
3. Настройте Web App в BotFather:
   ```
   /newapp  →  укажите URL вашего сервера, например https://game.example.com
   ```
4. Или добавьте кнопку меню бота:
   ```
   /mybots → выберите бота → Bot Settings → Menu Button → Edit Menu Button URL
   ```
5. Откройте бота в Telegram → нажмите кнопку Mini App.

После открытия Telegram автоматически передаёт `initData` в `window.Telegram.WebApp.initData`. Бэкенд верифицирует подпись HMAC-SHA256 и создаёт или обновляет запись пользователя в MongoDB.

---

## Лицензия

MIT — см. файл [LICENSE](LICENSE).
