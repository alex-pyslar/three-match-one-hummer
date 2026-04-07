import React, { useState, useEffect } from 'react'
import { useGameEngine } from '../hooks/useGameEngine'
import { api } from '../services/api'
import { ShopItem, SwipeDirection } from '../types'
import TileCell from './TileCell'
import HUD from './HUD'
import ShopModal from './ShopModal'
import GameOverModal from './GameOverModal'
import LevelWonModal from './LevelWonModal'
import ComboOverlay from './ComboOverlay'
import ScorePopup from './ScorePopup'

const GameBoard: React.FC = () => {
  const {
    state,
    handleSwipe,
    buyHint,
    reshuffle,
    upgradePassive,
    upgradeMultiplier,
    nextLevel,
    restart,
    buyShopItem,
  } = useGameEngine()

  const [shopOpen, setShopOpen] = useState(false)
  const [shopItems, setShopItems] = useState<ShopItem[]>([])

  useEffect(() => {
    api
      .getShopItems()
      .then(items => setShopItems(items))
      .catch(() => setShopItems([]))
  }, [])

  const onSwipe = (index: number, direction: SwipeDirection) => {
    handleSwipe(index, direction)
  }

  return (
    <div className="game-board">
      <HUD
        score={state.score}
        level={state.level}
        movesLeft={state.movesLeft}
        scoreTarget={state.scoreTarget}
        scoreMultiplier={state.scoreMultiplier}
        passiveIncome={state.passiveIncome}
        donationCurrency={state.donationCurrency}
      />

      <div className="game-board__grid-wrap">
        <div className={`game-grid${state.isProcessing ? ' game-grid--processing' : ''}`}>
          {state.grid.map((tile, index) => {
            const isHint =
              state.hintIndices !== null &&
              (state.hintIndices[0] === index || state.hintIndices[1] === index)
            return (
              <TileCell
                key={tile.id}
                tile={tile}
                isHint={isHint}
                index={index}
                onSwipe={direction => onSwipe(index, direction)}
              />
            )
          })}
        </div>
      </div>

      <div className="game-board__actions">
        <button
          className="btn btn--action"
          onClick={buyHint}
          disabled={state.isProcessing || state.score < 10}
          title="Подсказка"
        >
          💡 Подсказка (-10)
        </button>
        <button
          className="btn btn--action"
          onClick={reshuffle}
          disabled={state.isProcessing || state.score < 30}
          title="Перемешать"
        >
          🔀 Перемешать (-30)
        </button>
        <button
          className="btn btn--shop"
          onClick={() => setShopOpen(true)}
          title="Магазин"
        >
          🛒 Магазин
        </button>
      </div>

      <div className="game-board__upgrades">
        <button
          className="btn btn--upgrade"
          onClick={upgradePassive}
          disabled={state.isProcessing || state.score < 50}
          title="Улучшить пассивный доход"
        >
          ⚡ +Пассив (-50)
        </button>
        <button
          className="btn btn--upgrade"
          onClick={upgradeMultiplier}
          disabled={state.isProcessing || state.score < 25}
          title="Улучшить множитель"
        >
          🔢 +Множитель (-25)
        </button>
      </div>

      {/* Combo overlay — fixed, centered, re-animates via key on each increment */}
      <ComboOverlay
        key={`combo-${state.scorePopupKey}`}
        combo={state.combo}
        show={state.showCombo}
      />

      {/* Score popup — floats up from center */}
      <ScorePopup
        key={`score-${state.scorePopupKey}`}
        score={state.lastScoreEarned}
      />

      <ShopModal
        open={shopOpen}
        donationCurrency={state.donationCurrency}
        shopItems={shopItems}
        onBuy={buyShopItem}
        onClose={() => setShopOpen(false)}
      />

      {state.isGameOver && (
        <GameOverModal score={state.score} level={state.level} onRestart={restart} />
      )}

      {state.isLevelWon && (
        <LevelWonModal score={state.score} level={state.level} onNext={nextLevel} />
      )}
    </div>
  )
}

export default GameBoard
