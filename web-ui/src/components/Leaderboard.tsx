import React, { useEffect, useState } from 'react'
import { LeaderboardEntry, User } from '../types'
import { api } from '../services/api'

interface LeaderboardProps {
  currentUser: User | null
}

const Leaderboard: React.FC<LeaderboardProps> = ({ currentUser }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api.getLeaderboard()
      .then(data => {
        if (!cancelled) { setEntries(data ?? []); setLoading(false) }
      })
      .catch((err: Error) => {
        if (!cancelled) { setError(err.message ?? 'Ошибка загрузки'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="leaderboard">
        <h2 className="leaderboard__title">🏆 Рейтинг</h2>
        <div className="leaderboard__list">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="leaderboard__skeleton">
              <div className="skeleton skeleton--avatar" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--score" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="leaderboard">
        <h2 className="leaderboard__title">🏆 Рейтинг</h2>
        <div className="leaderboard__error">{error}</div>
      </div>
    )
  }

  return (
    <div className="leaderboard">
      <h2 className="leaderboard__title">🏆 Рейтинг</h2>
      <div className="leaderboard__list">
        {entries.slice(0, 50).map(entry => {
          const isMe = currentUser?.telegram_id === entry.telegram_id
          const displayName = entry.first_name || entry.username || 'Игрок'
          return (
            <div
              key={entry.telegram_id}
              className={`leaderboard__entry${isMe ? ' leaderboard__entry--current' : ''}`}
              style={{ animationDelay: `${Math.min(entry.rank - 1, 20) * 0.04}s` }}
            >
              <div className="leaderboard__rank">
                {entry.rank === 1 ? <span className="leaderboard__rank-medal">🥇</span>
                  : entry.rank === 2 ? <span className="leaderboard__rank-medal">🥈</span>
                  : entry.rank === 3 ? <span className="leaderboard__rank-medal">🥉</span>
                  : <span className="leaderboard__rank-num">#{entry.rank}</span>}
              </div>
              <div className="leaderboard__avatar">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt={displayName} className="leaderboard__avatar-img" />
                ) : (
                  <div className="leaderboard__avatar-initials">
                    {(entry.first_name?.[0] ?? entry.username?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
              </div>
              <div className="leaderboard__user-info">
                <div className="leaderboard__name">
                  {displayName}{isMe ? <span className="leaderboard__me-badge"> (я)</span> : ''}
                </div>
                {entry.username && <div className="leaderboard__username">@{entry.username}</div>}
              </div>
              <div className="leaderboard__scores">
                <div className="leaderboard__best-score">
                  <img src="/assets/valuta.png" alt="score" className="leaderboard__score-icon" />
                  <span>{entry.best_score.toLocaleString()}</span>
                </div>
                <div className="leaderboard__best-level">Ур. {entry.best_level}</div>
              </div>
            </div>
          )
        })}
        {entries.length === 0 && (
          <div className="leaderboard__empty">Пока нет данных 🎮</div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard
