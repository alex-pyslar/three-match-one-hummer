# ThreeMatchGame

A Match-3 puzzle game delivered as a **Telegram MiniApp**.
The frontend is a React + TypeScript SPA (Vite); the backend is a Go REST API (Gin + pgx); persistence is PostgreSQL.

---

## Table of Contents

1. [Quick Start (Docker)](#quick-start-docker)
2. [Manual Development Setup](#manual-development-setup)
3. [Environment Variables](#environment-variables)
4. [API Endpoints](#api-endpoints)
5. [Architecture](#architecture)
6. [Project Structure](#project-structure)
7. [Registering as a Telegram MiniApp](#registering-as-a-telegram-miniapp)

---

## Quick Start (Docker)

Requires: **Docker 24+** and **Docker Compose v2**.

```bash
# 1. Clone and enter the repo
git clone <repo-url> ThreeMatchGame
cd ThreeMatchGame

# 2. Create your local .env from the example
cp .env.example .env

# 3. Set your Telegram Bot Token (the only required change)
#    Open .env and replace "your_bot_token_here" with the token from @BotFather
$EDITOR .env

# 4. Build and start all services
docker compose up --build

# The app is now reachable at:
#   Nginx reverse proxy  → http://localhost:80
#   Frontend (direct)    → http://localhost:3000
#   Backend API (direct) → http://localhost:8080
#   PostgreSQL           → localhost:5432
```

To run in the background:

```bash
docker compose up --build -d
docker compose logs -f        # tail logs
docker compose down           # stop and remove containers
docker compose down -v        # also remove the pgdata volume
```

---

## Manual Development Setup

### Prerequisites

| Tool       | Minimum version |
|------------|-----------------|
| Node.js    | 18              |
| Go         | 1.22            |
| PostgreSQL | 15              |

### Frontend

```bash
cd frontend
npm install
npm run dev          # starts Vite dev server on http://localhost:5173
```

Copy `.env.example` to `frontend/.env.local` and set `VITE_API_URL` to point at your running backend:

```
VITE_API_URL=http://localhost:8080
```

### Backend

```bash
cd backend

# Apply the database schema (once)
psql -U match3user -d match3 -f migrations/001_initial.sql

# Run the server
go run ./cmd/server
```

The backend reads its configuration from environment variables (see [Environment Variables](#environment-variables)).
For local development you can export them in your shell or use a `.env` file loaded by `godotenv`.

---

## Environment Variables

| Variable            | Default                          | Description                                                   |
|---------------------|----------------------------------|---------------------------------------------------------------|
| `POSTGRES_PASSWORD` | `match3pass`                     | Password for the `match3user` PostgreSQL role.                |
| `TELEGRAM_BOT_TOKEN`| *(required)*                     | Token from @BotFather used to validate Telegram `initData`.   |
| `JWT_SECRET`        | `change_me_in_production_please` | HS256 signing key for JWT tokens (min. 32 random chars).      |
| `VITE_API_URL`      | `http://localhost:8080`          | Public URL of the backend, injected at frontend build time.   |
| `GIN_MODE`          | `release`                        | Set to `debug` for verbose Gin request logging.               |
| `SERVER_ADDR`       | `:8080`                          | Address the Go server listens on.                             |
| `DATABASE_URL`      | *(constructed by compose)*       | Full DSN; overrides all individual DB variables when set.     |

> **Security:** Never commit a real `.env` file. The `.env.example` template contains no secrets.

---

## API Endpoints

### Authentication

| Method | Path                  | Auth     | Description                                                                                           |
|--------|-----------------------|----------|-------------------------------------------------------------------------------------------------------|
| POST   | `/api/auth/telegram`  | None     | Validates Telegram WebApp `initData` (HMAC-SHA256), upserts the user record, returns a signed JWT. Body: `{ "initData": "<raw initData string>" }` |

### User

| Method | Path           | Auth     | Description                              |
|--------|----------------|----------|------------------------------------------|
| GET    | `/api/user/me` | JWT      | Returns the authenticated user's profile including `donationCurrency` balance. |

### Scores

| Method | Path          | Auth | Description                                                                               |
|--------|---------------|------|-------------------------------------------------------------------------------------------|
| POST   | `/api/scores` | JWT  | Records a game session result. Body: `{ "score": <int>, "level": <int> }`. Returns the saved score row. |

### Leaderboard

| Method | Path                        | Auth | Description                                                                              |
|--------|-----------------------------|------|------------------------------------------------------------------------------------------|
| GET    | `/api/leaderboard?limit=50` | None | Returns up to `limit` (max 200, default 50) players ranked by best score, with rank, username, avatar, best score, best level, and games played. |

### Shop

| Method | Path                  | Auth | Description                                                                                      |
|--------|-----------------------|------|--------------------------------------------------------------------------------------------------|
| GET    | `/api/shop/items`     | None | Returns all active shop items (id, name, description, itemType, price, value, icon).             |
| POST   | `/api/shop/purchase`  | JWT  | Purchases a shop item for the authenticated user. Deducts `donationCurrency`, records the transaction atomically. Body: `{ "itemId": <int> }` |

#### JWT Usage

Pass the token returned by `/api/auth/telegram` as a Bearer token:

```
Authorization: Bearer <token>
```

Tokens are HS256-signed and expire after **24 hours**.

---

## Architecture

```
                          ┌─────────────────────────────────────────┐
  Telegram Client         │             Docker Compose               │
  (WebApp iframe)         │                                          │
        │                 │  ┌──────────┐       ┌────────────────┐  │
        │  HTTPS          │  │          │ /api/* │                │  │
        └────────────────►│  │  nginx   ├───────►    backend     │  │
                          │  │ :80      │       │  (Go / Gin)    │  │
                          │  │          │       │  :8080         │  │
                          │  │          │ /*    │                │  │
                          │  │          ├───┐   └───────┬────────┘  │
                          │  └──────────┘   │           │           │
                          │                 │           │ pgx/v5    │
                          │                 ▼           ▼           │
                          │  ┌──────────────────┐  ┌────────────┐  │
                          │  │    frontend       │  │ PostgreSQL │  │
                          │  │ (React/Vite+nginx)│  │  :5432     │  │
                          │  │  :3000 → :80      │  │            │  │
                          │  └──────────────────┘  └────────────┘  │
                          └─────────────────────────────────────────┘

  Auth flow:
  1. Telegram injects initData into the WebApp
  2. Frontend POSTs initData to POST /api/auth/telegram
  3. Backend verifies HMAC-SHA256 against TELEGRAM_BOT_TOKEN
  4. Backend upserts user in PostgreSQL, returns signed JWT
  5. Frontend stores JWT; attaches it as Authorization: Bearer on
     every subsequent API call
```

---

## Project Structure

```
ThreeMatchGame/
├── docker-compose.yml          # Orchestrates all four services
├── nginx.conf                  # Reverse proxy: /api/* → backend, /* → frontend
├── .env.example                # Template for required environment variables
│
├── backend/
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   ├── cmd/
│   │   └── server/
│   │       └── main.go         # Entry point: wires config, DB pool, router
│   ├── migrations/
│   │   └── 001_initial.sql     # Schema: users, scores, shop_items, purchases
│   └── internal/
│       ├── config/
│       │   └── config.go       # Reads env vars into Config struct
│       ├── database/
│       │   └── database.go     # pgxpool setup and ping
│       ├── handlers/
│       │   ├── auth.go         # POST /api/auth/telegram
│       │   ├── scores.go       # POST /api/scores, GET /api/user/me
│       │   ├── leaderboard.go  # GET /api/leaderboard
│       │   └── shop.go         # GET /api/shop/items, POST /api/shop/purchase
│       ├── middleware/
│       │   ├── auth.go         # JWT validation middleware
│       │   └── cors.go         # CORS headers
│       └── models/
│           └── models.go       # User, Score, ShopItem, Purchase, LeaderboardEntry
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── public/
    └── src/
        ├── components/         # React UI components
        ├── game/
        │   └── gameLogic.ts    # Grid logic, match detection, specials (BOMB, RAINBOW)
        ├── hooks/
        │   └── useTelegram.ts  # Telegram WebApp SDK integration hook
        ├── services/           # API client functions
        └── types/
            └── index.ts        # Shared TypeScript types (GameState, Tile, etc.)
```

---

## Registering as a Telegram MiniApp

1. **Create a bot** — open a chat with [@BotFather](https://t.me/botfather) and send `/newbot`.
   Follow the prompts; copy the token into `TELEGRAM_BOT_TOKEN` in your `.env`.

2. **Deploy the stack** — run `docker compose up -d` on a publicly reachable server.
   Obtain the HTTPS URL of the frontend (e.g. `https://game.example.com`).

3. **Set the Menu Button URL** — in @BotFather:
   ```
   /mybots → <your bot> → Bot Settings → Menu Button → Edit Menu Button URL
   ```
   Paste your frontend URL (must be HTTPS).

4. **Optional — set the WebApp inline button** — in @BotFather:
   ```
   /mybots → <your bot> → Bot Settings → Configure Mini App
   ```
   Set the Mini App URL to the same HTTPS frontend URL.

5. **Test** — open Telegram, find your bot, tap the menu button.
   The game will load inside the Telegram WebApp frame and `initData` will be
   available for authentication via `window.Telegram.WebApp.initData`.

> **HTTPS is required.** Telegram will not load a MiniApp over plain HTTP.
> Use a reverse proxy (e.g. Caddy, Traefik, or Certbot with nginx) to terminate TLS
> in front of the Docker stack.
