import React from 'react'

interface GameOverModalProps {
  score: number
  level: number
  onRestart: () => void
}

const GameOverModal: React.FC<GameOverModalProps> = ({ score, level, onRestart }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-card game-over-modal">
        <div className="game-over-modal__icon">💔</div>
        <h2 className="game-over-modal__title">Игра окончена</h2>
        <div className="game-over-modal__stats">
          <div className="game-over-modal__stat">
            <span className="game-over-modal__stat-label">Счёт</span>
            <span className="game-over-modal__stat-value">{score}</span>
          </div>
          <div className="game-over-modal__stat">
            <span className="game-over-modal__stat-label">Уровень</span>
            <span className="game-over-modal__stat-value">{level}</span>
          </div>
        </div>
        <button className="btn btn--primary game-over-modal__btn" onClick={onRestart}>
          Начать заново
        </button>
      </div>
    </div>
  )
}

export default GameOverModal
