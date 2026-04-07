import React, { useState, useEffect } from 'react'
import { useTelegram } from './hooks/useTelegram'
import { setInitDataGetter } from './services/api'
import GameBoard from './components/GameBoard'
import Leaderboard from './components/Leaderboard'
import FallingParticles from './components/FallingParticles'
import './index.css'

type Tab = 'game' | 'leaderboard'

const App: React.FC = () => {
  const { tg, getInitData } = useTelegram()
  const [activeTab, setActiveTab] = useState<Tab>('game')

  // Register the initData getter for API calls
  useEffect(() => {
    setInitDataGetter(getInitData)
  }, [getInitData])

  // Apply Telegram theme colors as CSS variables
  useEffect(() => {
    if (tg?.themeParams) {
      const params = tg.themeParams
      const root = document.documentElement
      if (params.bg_color) root.style.setProperty('--tg-bg', params.bg_color)
      if (params.text_color) root.style.setProperty('--tg-text', params.text_color)
      if (params.hint_color) root.style.setProperty('--tg-hint', params.hint_color)
      if (params.button_color) root.style.setProperty('--tg-button', params.button_color)
      if (params.button_text_color)
        root.style.setProperty('--tg-button-text', params.button_text_color)
      if (params.secondary_bg_color)
        root.style.setProperty('--tg-secondary-bg', params.secondary_bg_color)
    }
  }, [tg])

  return (
    <div className="app">
      {/* Full-screen background particles — behind everything */}
      <FallingParticles />

      <div className="game-container">
        {activeTab === 'game' && <GameBoard />}
        {activeTab === 'leaderboard' && <Leaderboard />}
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
