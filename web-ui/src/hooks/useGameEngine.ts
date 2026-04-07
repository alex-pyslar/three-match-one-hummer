import { useCallback, useEffect, useRef, useState } from 'react'
import {
  generateGrid,
  checkMatches,
  processMatches,
  dropTiles,
  swapTiles,
  findHint,
  MOVES_PER_LEVEL,
  BASE_SCORE_TARGET,
  GRID_SIZE,
} from '../game/gameLogic'
import { GameState, SwipeDirection } from '../types'
import { api } from '../services/api'

const INITIAL_STATE: GameState = {
  grid: generateGrid(),
  score: 0,
  level: 1,
  movesLeft: MOVES_PER_LEVEL,
  scoreTarget: BASE_SCORE_TARGET,
  scoreMultiplier: 1,
  passiveIncome: 1,
  donationCurrency: 0,
  isProcessing: false,
  isGameOver: false,
  isLevelWon: false,
  hintIndices: null,
  combo: 0,
  showCombo: false,
  lastScoreEarned: 0,
  scorePopupKey: 0,
}

function getSwapIndex(index: number, direction: SwipeDirection): number | null {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE

  switch (direction) {
    case 'left':  return col === 0              ? null : index - 1
    case 'right': return col === GRID_SIZE - 1  ? null : index + 1
    case 'up':    return row === 0              ? null : index - GRID_SIZE
    case 'down':  return row === GRID_SIZE - 1  ? null : index + GRID_SIZE
  }
}

export function useGameEngine() {
  const [state, setState] = useState<GameState>(INITIAL_STATE)
  const processingRef   = useRef(false)
  const comboTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load saved progress on mount ────────────────────────────────────────────
  useEffect(() => {
    api.getProgress()
      .then(progress => {
        if (!progress) return
        setState(prev => ({
          ...prev,
          level:            progress.level            || 1,
          score:            progress.score            || 0,
          scoreMultiplier:  progress.score_multiplier || 1,
          passiveIncome:    progress.passive_income   || 1,
          donationCurrency: progress.donation_currency || 0,
          movesLeft:        progress.moves_left       || MOVES_PER_LEVEL,
          scoreTarget:      progress.score_target     || BASE_SCORE_TARGET,
          grid:             generateGrid(),            // always start with a fresh board
        }))
      })
      .catch(() => {/* ignore — use default state */})
  }, [])

  // ── Passive income tick ─────────────────────────────────────────────────────
  useEffect(() => {
    passiveTimerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.isGameOver) return prev
        return { ...prev, score: prev.score + prev.passiveIncome }
      })
    }, 5000)
    return () => { if (passiveTimerRef.current) clearInterval(passiveTimerRef.current) }
  }, [])

  // ── Debounced progress saver ────────────────────────────────────────────────
  const scheduleSave = useCallback((s: GameState) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      api.saveProgress({
        level:             s.level,
        score:             s.score,
        score_multiplier:  s.scoreMultiplier,
        passive_income:    s.passiveIncome,
        donation_currency: s.donationCurrency,
        moves_left:        s.movesLeft,
        score_target:      s.scoreTarget,
      }).catch(() => {/* fire-and-forget */})
    }, 1500)
  }, [])

  // ── Cascade engine ──────────────────────────────────────────────────────────
  const cascade = useCallback(
    async (
      initialGrid: ReturnType<typeof generateGrid>,
      currentScore: number,
      currentMultiplier: number,
      currentLevel: number,
      currentScoreTarget: number,
      currentMoves: number,
    ) => {
      let grid  = initialGrid
      let score = currentScore
      let combo = 0

      while (true) {
        const matchResult = checkMatches(grid)
        if (matchResult.indices.size === 0) break

        combo++
        const comboMultiplier = Math.max(1, combo / 2 + 1)
        const gained = Math.floor(matchResult.indices.size * currentMultiplier * comboMultiplier)
        score += gained

        grid = processMatches(grid, matchResult)
        grid = dropTiles(grid)

        await new Promise<void>(resolve => setTimeout(resolve, 350))

        setState(prev => ({
          ...prev,
          grid:            [...grid],
          score,
          combo,
          showCombo:       combo >= 2,
          lastScoreEarned: gained,
          scorePopupKey:   prev.scorePopupKey + 1,
        }))
      }

      // Hide combo banner after 1.5 s
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      comboTimerRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, showCombo: false }))
      }, 1500)

      const newMoves   = currentMoves - 1
      const isLevelWon = score >= currentScoreTarget
      const isGameOver = !isLevelWon && newMoves <= 0

      processingRef.current = false

      const finalState: Partial<GameState> = {
        grid:        [...grid],
        score,
        movesLeft:   newMoves,
        isProcessing: false,
        isGameOver,
        isLevelWon,
        combo,
      }

      setState(prev => {
        const next = { ...prev, ...finalState }
        scheduleSave(next)
        return next
      })

      // Submit score on game-end events
      if (isLevelWon || isGameOver) {
        api.submitScore(score, currentLevel).catch(() => {})
      }
    },
    [scheduleSave],
  )

  // ── Swipe handler ───────────────────────────────────────────────────────────
  const handleSwipe = useCallback(
    (index: number, direction: SwipeDirection) => {
      setState(prev => {
        if (prev.isProcessing || prev.isGameOver || prev.isLevelWon) return prev
        if (processingRef.current) return prev

        const targetIndex = getSwapIndex(index, direction)
        if (targetIndex === null) return prev

        const swapped     = swapTiles(prev.grid, index, targetIndex)
        const matchResult = checkMatches(swapped)

        if (matchResult.indices.size === 0) {
          // No match — animate swap then revert
          processingRef.current = true
          const reverted = swapTiles(swapped, index, targetIndex)
          setTimeout(() => {
            processingRef.current = false
            setState(s => ({ ...s, grid: reverted, isProcessing: false }))
          }, 300)
          return { ...prev, grid: swapped, isProcessing: true }
        }

        // Valid swap — start cascade
        processingRef.current = true
        const captured = {
          score:            prev.score,
          multiplier:       prev.scoreMultiplier,
          level:            prev.level,
          scoreTarget:      prev.scoreTarget,
          movesLeft:        prev.movesLeft,
          donationCurrency: prev.donationCurrency,
          passiveIncome:    prev.passiveIncome,
        }

        setTimeout(() => {
          cascade(
              swapped,
              captured.score,
              captured.multiplier,
              captured.level,
              captured.scoreTarget,
              captured.movesLeft,
           ).then(() => console.log())
        }, 0)

        return { ...prev, grid: swapped, isProcessing: true, hintIndices: null }
      })
    },
    [cascade],
  )

  // ── Hint ────────────────────────────────────────────────────────────────────
  const buyHint = useCallback(() => {
    setState(prev => {
      if (prev.score < 10 || prev.isProcessing) return prev
      const hint = findHint(prev.grid)
      if (!hint) return prev

      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      hintTimerRef.current = setTimeout(() => {
        setState(s => ({ ...s, hintIndices: null }))
      }, 2000)

      return { ...prev, score: prev.score - 10, hintIndices: hint }
    })
  }, [])

  // ── Reshuffle ───────────────────────────────────────────────────────────────
  const reshuffle = useCallback(() => {
    setState(prev => {
      if (prev.score < 30 || prev.isProcessing) return prev
      return { ...prev, score: prev.score - 30, grid: generateGrid(), hintIndices: null }
    })
  }, [])

  // ── Upgrade passive income ──────────────────────────────────────────────────
  const upgradePassive = useCallback(() => {
    setState(prev => {
      if (prev.score < 50 || prev.isProcessing) return prev
      const next = { ...prev, score: prev.score - 50, passiveIncome: prev.passiveIncome + 1 }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // ── Upgrade score multiplier ────────────────────────────────────────────────
  const upgradeMultiplier = useCallback(() => {
    setState(prev => {
      if (prev.score < 25 || prev.isProcessing) return prev
      const next = { ...prev, score: prev.score - 25, scoreMultiplier: prev.scoreMultiplier + 0.5 }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // ── Next level ──────────────────────────────────────────────────────────────
  const nextLevel = useCallback(() => {
    setState(prev => {
      const newLevel       = prev.level + 1
      const newScoreTarget = Math.floor(prev.scoreTarget * 1.6)
      const newMoves       = MOVES_PER_LEVEL + newLevel * 2
      const next: GameState = {
        ...prev,
        level:        newLevel,
        movesLeft:    newMoves,
        scoreTarget:  newScoreTarget,
        grid:         generateGrid(),
        isLevelWon:   false,
        isGameOver:   false,
        hintIndices:  null,
        combo:        0,
        showCombo:    false,
        isProcessing: false,
      }
      scheduleSave(next)
      return next
    })
    processingRef.current = false
  }, [scheduleSave])

  // ── Restart ─────────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    processingRef.current = false
    if (comboTimerRef.current)   clearTimeout(comboTimerRef.current)
    if (hintTimerRef.current)    clearTimeout(hintTimerRef.current)
    if (saveTimerRef.current)    clearTimeout(saveTimerRef.current)
    const fresh = { ...INITIAL_STATE, grid: generateGrid() }
    setState(fresh)
    scheduleSave(fresh)
  }, [scheduleSave])

  // ── Shop purchase ───────────────────────────────────────────────────────────
  const buyShopItem = useCallback((amount: number) => {
    setState(prev => {
      const next = { ...prev, donationCurrency: prev.donationCurrency + amount }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  return {
    state,
    handleSwipe,
    buyHint,
    reshuffle,
    upgradePassive,
    upgradeMultiplier,
    nextLevel,
    restart,
    buyShopItem,
  }
}
