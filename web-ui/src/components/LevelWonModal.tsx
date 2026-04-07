import React from 'react'

interface LevelWonModalProps {
  score: number
  level: number
  onNext: () => void
}

const LevelWonModal: React.FC<LevelWonModalProps> = ({ score, level, onNext }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-card level-won-modal">
        <div className="level-won-modal__star" aria-hidden="true">
          ⭐
        </div>
        <h2 className="level-won-modal__title">Уровень {level} пройден!</h2>
        <div className="level-won-modal__stats">
          <div className="level-won-modal__stat">
            <span className="level-won-modal__stat-label">Счёт</span>
            <span className="level-won-modal__stat-value">{score}</span>
          </div>
        </div>
        <button className="btn btn--success level-won-modal__btn" onClick={onNext}>
          Следующий уровень →
        </button>
      </div>
    </div>
  )
}

export default LevelWonModal
