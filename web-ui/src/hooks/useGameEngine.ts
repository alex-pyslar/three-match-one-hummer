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
import { ActionCosts, GameState, SwipeDirection } from '../types'
import { api } from '../services/api'

// ── Cost formulas (exported so buttons can display current cost) ──────────────

/** Hint cost scales linearly with level: 10, 15, 20 … */
export function calcHintCost(level: number): number {
  return 10 + (level - 1) * 5
}
/** Reshuffle cost scales faster: 30, 45, 60 … */
export function calcReshuffleCost(level: number): number {
  return 30 + (level - 1) * 15
}
/** Passive upgrade cost scales with the current passive level (50 → 100 → 150 …) */
export function calcPassiveUpgradeCost(passiveIncome: number): number {
  return passiveIncome * 50
}
/** Multiplier upgrade cost scales with the current multiplier value */
export function calcMultiplierUpgradeCost(scoreMultiplier: number): number {
  return Math.round(scoreMultiplier * 50)
}

// ── Initial state ─────────────────────────────────────────────────────────────

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
  noMovesAlert: false,
  lastScoreEarned: 0,
  scorePopupKey: 0,
}

function getSwapIndex(index: number, direction: SwipeDirection): number | null {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE
  switch (direction) {
    case 'left':  return col === 0             ? null : index - 1
    case 'right': return col === GRID_SIZE - 1 ? null : index + 1
    case 'up':    return row === 0             ? null : index - GRID_SIZE
    case 'down':  return row === GRID_SIZE - 1 ? null : index + GRID_SIZE
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGameEngine() {
  const [state, setState] = useState<GameState>(INITIAL_STATE)
  const processingRef     = useRef(false)
  const comboTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noMovesTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passiveTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load saved progress on mount ─────────────────────────────────────────────
  // setInitDataGetter is called synchronously in App before children mount,
  // so authHeaders() is always populated when this effect fires.
  useEffect(() => {
    api.getProgress()
      .then(progress => {
        if (!progress) return
        setState(prev => ({
          ...prev,
          level:            Math.max(1, progress.level),
          score:            Math.max(0, progress.score),
          scoreMultiplier:  Math.max(1, progress.score_multiplier),
          passiveIncome:    Math.max(1, progress.passive_income),
          donationCurrency: Math.max(0, progress.donation_currency),
          movesLeft:        Math.max(1, progress.moves_left),
          scoreTarget:      Math.max(BASE_SCORE_TARGET, progress.score_target),
          grid:             generateGrid(), // fresh visual board each session
        }))
      })
      .catch(() => { /* no progress saved yet or auth failed — use defaults */ })
  }, [])

  // ── Passive income tick ───────────────────────────────────────────────────────
  useEffect(() => {
    passiveTimerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.isGameOver || prev.isLevelWon) return prev
        return { ...prev, score: prev.score + prev.passiveIncome }
      })
    }, 5000)
    return () => { if (passiveTimerRef.current) clearInterval(passiveTimerRef.current) }
  }, [])

  // ── Debounced server save ────────────────────────────────────────────────────
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
      }).catch(() => { /* fire-and-forget */ })
    }, 1500)
  }, [])

  // ── Auto-reshuffle when no valid moves remain ─────────────────────────────────
  const autoReshuffleIfNeeded = useCallback((grid: ReturnType<typeof generateGrid>) => {
    if (findHint(grid) !== null) return grid // moves exist — do nothing

    // No valid moves: silently generate a new board until one has moves
    let fresh = generateGrid()
    let attempts = 0
    while (findHint(fresh) === null && attempts < 20) {
      fresh = generateGrid()
      attempts++
    }

    // Show brief "no moves" alert
    if (noMovesTimerRef.current) clearTimeout(noMovesTimerRef.current)
    setState(prev => ({ ...prev, noMovesAlert: true }))
    noMovesTimerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, noMovesAlert: false }))
    }, 1800)

    return fresh
  }, [])

  // ── Cascade engine ────────────────────────────────────────────────────────────
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
        const comboMultiplier = 1 + (combo - 1) * 0.5    // 1.0 → 1.5 → 2.0 …
        const gained = Math.floor(matchResult.indices.size * currentMultiplier * comboMultiplier)
        score += gained

        grid = processMatches(grid, matchResult)
        grid = dropTiles(grid)

        await new Promise<void>(resolve => setTimeout(resolve, 320))

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

      // Auto-reshuffle if the resulting board has no valid moves
      grid = autoReshuffleIfNeeded(grid)

      // Hide combo banner after 1.5 s
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      comboTimerRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, showCombo: false }))
      }, 1500)

      const newMoves   = currentMoves - 1
      const isLevelWon = score >= currentScoreTarget
      const isGameOver = !isLevelWon && newMoves <= 0

      processingRef.current = false

      setState(prev => {
        const next: GameState = {
          ...prev,
          grid:         [...grid],
          score,
          movesLeft:    newMoves,
          isProcessing: false,
          isGameOver,
          isLevelWon,
          combo,
        }
        scheduleSave(next)
        return next
      })

      if (isLevelWon || isGameOver) {
        api.submitScore(score, currentLevel).catch(() => {})
      }
    },
    [scheduleSave, autoReshuffleIfNeeded],
  )

  // ── Swipe handler ─────────────────────────────────────────────────────────────
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
          processingRef.current = true
          const reverted = swapTiles(swapped, index, targetIndex)
          setTimeout(() => {
            processingRef.current = false
            setState(s => ({ ...s, grid: reverted, isProcessing: false }))
          }, 280)
          return { ...prev, grid: swapped, isProcessing: true }
        }

        processingRef.current = true
        const captured = {
          score:       prev.score,
          multiplier:  prev.scoreMultiplier,
          level:       prev.level,
          scoreTarget: prev.scoreTarget,
          movesLeft:   prev.movesLeft,
        }

        setTimeout(() => {
          cascade(
            swapped,
            captured.score,
            captured.multiplier,
            captured.level,
            captured.scoreTarget,
            captured.movesLeft,
          )
        }, 0)

        return { ...prev, grid: swapped, isProcessing: true, hintIndices: null }
      })
    },
    [cascade],
  )

  // ── Hint ──────────────────────────────────────────────────────────────────────
  const buyHint = useCallback(() => {
    setState(prev => {
      const cost = calcHintCost(prev.level)
      if (prev.score < cost || prev.isProcessing) return prev
      const hint = findHint(prev.grid)
      if (!hint) return prev

      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      hintTimerRef.current = setTimeout(() => {
        setState(s => ({ ...s, hintIndices: null }))
      }, 2000)

      return { ...prev, score: prev.score - cost, hintIndices: hint }
    })
  }, [])

  // ── Reshuffle ──────────────────────────────────────────────────────────────────
  const reshuffle = useCallback(() => {
    setState(prev => {
      const cost = calcReshuffleCost(prev.level)
      if (prev.score < cost || prev.isProcessing) return prev
      return { ...prev, score: prev.score - cost, grid: generateGrid(), hintIndices: null }
    })
  }, [])

  // ── Upgrade passive income ────────────────────────────────────────────────────
  const upgradePassive = useCallback(() => {
    setState(prev => {
      const cost = calcPassiveUpgradeCost(prev.passiveIncome)
      if (prev.score < cost || prev.isProcessing) return prev
      const next = { ...prev, score: prev.score - cost, passiveIncome: prev.passiveIncome + 1 }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // ── Upgrade score multiplier ──────────────────────────────────────────────────
  const upgradeMultiplier = useCallback(() => {
    setState(prev => {
      const cost = calcMultiplierUpgradeCost(prev.scoreMultiplier)
      if (prev.score < cost || prev.isProcessing) return prev
      const next = { ...prev, score: prev.score - cost, scoreMultiplier: Math.round((prev.scoreMultiplier + 0.5) * 10) / 10 }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // ── Next level ────────────────────────────────────────────────────────────────
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
        noMovesAlert: false,
        isProcessing: false,
      }
      scheduleSave(next)
      return next
    })
    processingRef.current = false
  }, [scheduleSave])

  // ── Restart ───────────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    processingRef.current = false
    if (comboTimerRef.current)   clearTimeout(comboTimerRef.current)
    if (hintTimerRef.current)    clearTimeout(hintTimerRef.current)
    if (noMovesTimerRef.current) clearTimeout(noMovesTimerRef.current)
    if (saveTimerRef.current)    clearTimeout(saveTimerRef.current)
    const fresh = { ...INITIAL_STATE, grid: generateGrid() }
    setState(fresh)
    scheduleSave(fresh)
  }, [scheduleSave])

  // ── Shop purchase ─────────────────────────────────────────────────────────────
  const buyShopItem = useCallback((amount: number) => {
    setState(prev => {
      const next = { ...prev, donationCurrency: prev.donationCurrency + amount }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // ── Computed costs (derived from current state) ───────────────────────────────
  const costs: ActionCosts = {
    hint:              calcHintCost(state.level),
    reshuffle:         calcReshuffleCost(state.level),
    upgradePassive:    calcPassiveUpgradeCost(state.passiveIncome),
    upgradeMultiplier: calcMultiplierUpgradeCost(state.scoreMultiplier),
  }

  return {
    state,
    costs,
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
