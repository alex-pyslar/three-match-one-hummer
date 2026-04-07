import { GameProgress, LeaderboardEntry, ShopItem, User } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

let _getInitData: () => string = () => ''

export function setInitDataGetter(fn: () => string) {
  _getInitData = fn
}

function authHeaders(): HeadersInit {
  const initData = _getInitData()
  return {
    'Content-Type': 'application/json',
    Authorization: initData ? `tma ${initData}` : '',
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      message = data?.error ?? data?.message ?? message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }
  // 204 No Content — return null
  if (res.status === 204) return null as unknown as T
  const text = await res.text()
  if (!text) return undefined as unknown as T
  return JSON.parse(text) as T
}

export const api = {
  /** Submit a finished game result (score + level reached). */
  async submitScore(score: number, level: number): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/scores`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ score, level }),
    })
    await handleResponse<void>(res)
  },

  /** Fetch the global leaderboard (top 50). */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const res = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: authHeaders(),
    })
    return handleResponse<LeaderboardEntry[]>(res)
  },

  /** Fetch all active shop items. */
  async getShopItems(): Promise<ShopItem[]> {
    const res = await fetch(`${BASE_URL}/api/shop/items`, {
      headers: authHeaders(),
    })
    return handleResponse<ShopItem[]>(res)
  },

  /** Purchase a shop item by MongoDB ObjectID string. */
  async purchaseItem(itemId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/shop/purchase`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ item_id: itemId }),
    })
    await handleResponse<void>(res)
  },

  /** Get the authenticated user's profile. */
  async getMe(): Promise<User> {
    const res = await fetch(`${BASE_URL}/api/user/me`, {
      headers: authHeaders(),
    })
    return handleResponse<User>(res)
  },

  /**
   * Load saved game progress for the current user.
   * Returns null if no progress has been saved yet (HTTP 204).
   */
  async getProgress(): Promise<GameProgress | null> {
    const res = await fetch(`${BASE_URL}/api/user/progress`, {
      headers: authHeaders(),
    })
    return handleResponse<GameProgress | null>(res)
  },

  /** Persist the current game progress on the server. Fire-and-forget safe. */
  async saveProgress(progress: Omit<GameProgress, 'user_id'>): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/user/progress`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(progress),
    })
    await handleResponse<void>(res)
  },
}
