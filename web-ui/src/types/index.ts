export enum SpecialType {
  NONE = 'NONE',
  BOMB = 'BOMB',
  RAINBOW = 'RAINBOW',
}

export interface Tile {
  imageIndex: number
  special: SpecialType
  id: string
}

export interface MatchResult {
  indices: Set<number>
  newSpecials: Array<[number, SpecialType]>
}

export interface GameState {
  grid: Tile[]
  score: number
  level: number
  movesLeft: number
  scoreTarget: number
  scoreMultiplier: number
  passiveIncome: number
  donationCurrency: number
  isProcessing: boolean
  isGameOver: boolean
  isLevelWon: boolean
  hintIndices: [number, number] | null
  combo: number
  showCombo: boolean
  noMovesAlert: boolean       // true briefly when board auto-reshuffled
  lastScoreEarned: number
  scorePopupKey: number
}

/** Costs for in-game actions — recalculated each render from state */
export interface ActionCosts {
  hint: number
  reshuffle: number
  upgradePassive: number
  upgradeMultiplier: number
}

export interface GameProgress {
  user_id: number
  level: number
  score: number
  score_multiplier: number
  passive_income: number
  donation_currency: number
  moves_left: number
  score_target: number
}

export interface LeaderboardEntry {
  rank: number
  telegram_id: number
  username: string
  first_name: string
  best_score: number
  best_level: number
  avatar_url?: string
}

export interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  value: number
  item_type: string
  icon: string
}

export interface User {
  telegram_id: number
  username: string
  first_name: string
  last_name?: string
  avatar_url?: string
  donation_currency: number
}

export interface AuthResponse {
  token: string
  user: User
}

export type SwipeDirection = 'up' | 'down' | 'left' | 'right'
