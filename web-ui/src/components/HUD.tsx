import React from 'react'
import { User } from '../types'

interface HUDProps {
  score: number
  level: number
  movesLeft: number
  scoreTarget: number
  scoreMultiplier: number
  passiveIncome: number
  donationCurrency: number
  noMovesAlert: boolean
  user: User | null
}

const HUD: React.FC<HUDProps> = ({
  score,
  level,
  movesLeft,
  scoreTarget,
  scoreMultiplier,
  passiveIncome,
  donationCurrency,
  noMovesAlert,
  user,
}) => {
  const progress  = Math.min(1, score / scoreTarget)
  const movesLow  = movesLeft <= 5

  return (
    <div className="hud">
      {/* User identity row */}
      {user && (
        <div className="hud__user-row">
          <div className="hud__avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.first_name} className="hud__avatar-img" />
            ) : (
              <div className="hud__avatar-initials">
                {(user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase()}
              </div>
            )}
          </div>
          <div className="hud__user-info">
            <span className="hud__user-name">
              {user.first_name}{user.last_name ? ` ${user.last_name}` : ''}
            </span>
            {user.username && (
              <span className="hud__user-handle">@{user.username}</span>
            )}
          </div>
          <div className="hud__title">Три в ряд</div>
        </div>
      )}

      {!user && <div className="hud__title">Три в ряд, один молоток</div>}

      {/* Currency chips */}
      <div className="hud__currency-row">
        <div className="hud__chip hud__chip--score">
          <img src="/assets/valuta.png" alt="score" className="hud__chip-icon" />
          <span className="hud__chip-value">{score.toLocaleString()}</span>
        </div>
        <div className="hud__chip hud__chip--donation">
          <img src="/assets/donation.png" alt="donation" className="hud__chip-icon" />
          <span className="hud__chip-value">{donationCurrency}</span>
        </div>
        <div className="hud__chip hud__chip--multiplier">
          <span className="hud__chip-label">×</span>
          <span className="hud__chip-value">{scoreMultiplier.toFixed(1)}</span>
        </div>
        <div className="hud__chip hud__chip--passive">
          <span className="hud__chip-label">+{passiveIncome}/5s</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="hud__stats-row">
        <div className="hud__stat">
          <span className="hud__stat-label">Уровень</span>
          <span className="hud__stat-value">{level}</span>
        </div>
        <div className="hud__stat-divider" />
        <div className={`hud__stat${movesLow ? ' hud__stat--warning' : ''}`}>
          <span className="hud__stat-label">Ходы</span>
          <span className={`hud__stat-value${movesLow ? ' hud__stat-value--low' : ''}`}>
            {movesLeft}
          </span>
        </div>
        <div className="hud__stat-divider" />
        <div className="hud__stat">
          <span className="hud__stat-label">Цель</span>
          <span className="hud__stat-value">{scoreTarget.toLocaleString()}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="hud__progress-bar" title={`${Math.round(progress * 100)}%`}>
        <div className="hud__progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* No-moves alert */}
      {noMovesAlert && (
        <div className="hud__no-moves-alert" aria-live="polite">
          🔀 Нет ходов — перемешиваем!
        </div>
      )}
    </div>
  )
}

export default HUD
