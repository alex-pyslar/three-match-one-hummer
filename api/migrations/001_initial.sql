-- 001_initial.sql
-- Initial schema for the match-3 Telegram game backend.

CREATE TABLE IF NOT EXISTS users (
    id                BIGSERIAL    PRIMARY KEY,
    telegram_id       BIGINT       UNIQUE NOT NULL,
    username          VARCHAR(255) DEFAULT '',
    first_name        VARCHAR(255) DEFAULT '',
    last_name         VARCHAR(255) DEFAULT '',
    avatar_url        TEXT         DEFAULT '',
    donation_currency INTEGER      DEFAULT 0,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score      INTEGER     NOT NULL,
    level      INTEGER     NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_user_id   ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_score_desc ON scores(score DESC);

CREATE TABLE IF NOT EXISTS shop_items (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT         DEFAULT '',
    item_type   VARCHAR(50)  NOT NULL,
    price       INTEGER      NOT NULL DEFAULT 0,
    value       INTEGER      NOT NULL DEFAULT 0,
    icon        VARCHAR(100) DEFAULT '',
    active      BOOLEAN      DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS purchases (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id     BIGINT      NOT NULL REFERENCES shop_items(id),
    quantity    INTEGER     DEFAULT 1,
    total_price INTEGER     NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed shop items (idempotent).
INSERT INTO shop_items (name, description, item_type, price, value, icon)
VALUES
    ('Малый пакет',   '+10 донат-монет',                          'donation_pack', 0,  10, 'shop1.png'),
    ('Средний пакет', '+25 донат-монет',                          'donation_pack', 0,  25, 'shop2.png'),
    ('Большой пакет', '+50 донат-монет',                          'donation_pack', 0,  50, 'shop3.png'),
    ('+5 ходов',      'Добавляет 5 ходов к текущему уровню',      'extra_moves',  20,   5, 'valuta.png'),
    ('Множитель ×2',  'Удваивает очки на 1 уровень',              'score_boost',  30,   2, 'valuta.png')
ON CONFLICT DO NOTHING;
