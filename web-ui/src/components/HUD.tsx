import React from 'react'

interface HUDProps {
  score: number
  level: number
  movesLeft: number
  scoreTarget: number
  scoreMultiplier: number
  passiveIncome: number
  donationCurrency: number
}

const HUD: React.FC<HUDProps> = ({
  score,
  level,
  movesLeft,
  scoreTarget,
  scoreMultiplier,
  passiveIncome,
  donationCurrency,
}) => {
  const progress = Math.min(1, score / scoreTarget)

  return (
    <div className="hud">
      <div className="hud__title">Три в ряд, один молоток</div>

      <div className="hud__currency-row">
        <div className="hud__chip hud__chip--score">
          <img src="/assets/valuta.png" alt="score" className="hud__chip-icon" />
          <span className="hud__chip-value">{score}</span>
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

      <div className="hud__stats-row">
        <div className="hud__stat">
          <span className="hud__stat-label">Уровень</span>
          <span className="hud__stat-value">{level}</span>
        </div>
        <div className="hud__stat-divider" />
        <div className="hud__stat">
          <span className="hud__stat-label">Ходы</span>
          <span className="hud__stat-value hud__stat-value--moves">{movesLeft}</span>
        </div>
        <div className="hud__stat-divider" />
        <div className="hud__stat">
          <span className="hud__stat-label">Цель</span>
          <span className="hud__stat-value">{scoreTarget}</span>
        </div>
      </div>

      <div className="hud__progress-bar">
        <div className="hud__progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}

export default HUD
