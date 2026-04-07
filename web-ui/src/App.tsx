import React, { useState, useEffect } from 'react'
import { useTelegram } from './hooks/useTelegram'
import { setInitDataGetter, api } from './services/api'
import { User } from './types'
import GameBoard from './components/GameBoard'
import Leaderboard from './components/Leaderboard'
import FallingParticles from './components/FallingParticles'
import './index.css'

type Tab = 'game' | 'leaderboard'

const App: React.FC = () => {
  const { tg, getInitData, user: tgUser } = useTelegram()
  const [activeTab, setActiveTab] = useState<Tab>('game')
  const [serverUser, setServerUser] = useState<User | null>(null)

  // ── Register initData getter SYNCHRONOUSLY before any child effects fire ──────
  // This ensures all authenticated API calls in child useEffects have valid headers.
  setInitDataGetter(getInitData)

  // ── Upsert user in DB + apply Telegram theme colors ───────────────────────────
  useEffect(() => {
    // Apply Telegram theme colors as CSS variables
    if (tg?.themeParams) {
      const p = tg.themeParams
      const r = document.documentElement
      if (p.bg_color)             r.style.setProperty('--tg-bg',           p.bg_color)
      if (p.text_color)           r.style.setProperty('--tg-text',         p.text_color)
      if (p.hint_color)           r.style.setProperty('--tg-hint',         p.hint_color)
      if (p.button_color)         r.style.setProperty('--tg-button',       p.button_color)
      if (p.button_text_color)    r.style.setProperty('--tg-button-text',  p.button_text_color)
      if (p.secondary_bg_color)   r.style.setProperty('--tg-secondary-bg', p.secondary_bg_color)
    }

    // Authenticate + upsert user in MongoDB
    const initData = getInitData()
    if (!initData) return
    api.authTelegram(initData)
      .then(resp => setServerUser(resp.user))
      .catch(() => { /* outside Telegram or dev mode — continue without server profile */ })
  }, [tg, getInitData])

  // Build a display user merging Telegram's local data (instant) with server data
  const displayUser: User | null = serverUser ?? (tgUser ? {
    telegram_id:      tgUser.id,
    username:         tgUser.username ?? '',
    first_name:       tgUser.first_name,
    last_name:        tgUser.last_name,
    avatar_url:       tgUser.photo_url,
    donation_currency: 0,
  } : null)

  return (
    <div className="app">
      {/* Full-screen background particles — z-index 0, behind everything */}
      <FallingParticles />

      <div className="game-container">
        {activeTab === 'game'        && <GameBoard user={displayUser} />}
        {activeTab === 'leaderboard' && <Leaderboard currentUser={displayUser} />}
      </div>

      <nav className="tab-bar">
        <button
          className={`tab-bar__tab${activeTab === 'game' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => setActiveTab('game')}
        >
          <span className="tab-bar__icon">🎮</span>
          <span className="tab-bar__label">Игра</span>
        </button>
        <button
          className={`tab-bar__tab${activeTab === 'leaderboard' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <span className="tab-bar__icon">🏆</span>
          <span className="tab-bar__label">Рейтинг</span>
        </button>
      </nav>
    </div>
  )
}

export default App
