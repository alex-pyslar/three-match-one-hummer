import { v4 as uuidv4 } from 'uuid'
import { Tile, SpecialType, MatchResult } from '../types'

export const GRID_SIZE = 6
export const TOTAL_TILES = 36
export const NUM_TILE_TYPES = 5
export const MOVES_PER_LEVEL = 30
export const BASE_SCORE_TARGET = 150

function randomTileIndex(): number {
  return Math.floor(Math.random() * NUM_TILE_TYPES)
}

function createTile(imageIndex: number, special: SpecialType = SpecialType.NONE): Tile {
  return { imageIndex, special, id: uuidv4() }
}

function hasMatchesInGrid(grid: Tile[]): boolean {
  // Check horizontal
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col <= GRID_SIZE - 3; col++) {
      const idx = row * GRID_SIZE + col
      if (
        grid[idx].imageIndex === grid[idx + 1].imageIndex &&
        grid[idx].imageIndex === grid[idx + 2].imageIndex
      ) {
        return true
      }
    }
  }
  // Check vertical
  for (let row = 0; row <= GRID_SIZE - 3; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = row * GRID_SIZE + col
      if (
        grid[idx].imageIndex === grid[idx + GRID_SIZE].imageIndex &&
        grid[idx].imageIndex === grid[idx + GRID_SIZE * 2].imageIndex
      ) {
        return true
      }
    }
  }
  return false
}

export function generateGrid(): Tile[] {
  // Try 200 random grids
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid: Tile[] = Array.from({ length: TOTAL_TILES }, () =>
      createTile(randomTileIndex())
    )
    if (!hasMatchesInGrid(grid)) {
      return grid
    }
  }

  // Fallback: build row by row avoiding 3-in-a-row
  const grid: Tile[] = []
  for (let i = 0; i < TOTAL_TILES; i++) {
    const row = Math.floor(i / GRID_SIZE)
    const col = i % GRID_SIZE
    let imageIndex: number
    let tries = 0
    do {
      imageIndex = randomTileIndex()
      tries++
      if (tries > 20) break
    } while (
      (col >= 2 &&
        grid[i - 1].imageIndex === imageIndex &&
        grid[i - 2].imageIndex === imageIndex) ||
      (row >= 2 &&
        grid[i - GRID_SIZE].imageIndex === imageIndex &&
        grid[i - GRID_SIZE * 2].imageIndex === imageIndex)
    )
    grid.push(createTile(imageIndex))
  }
  return grid
}

export function checkMatches(grid: Tile[]): MatchResult {
  const matchedIndices = new Set<number>()
  const newSpecials: Array<[number, SpecialType]> = []

  // Horizontal runs
  for (let row = 0; row < GRID_SIZE; row++) {
    let col = 0
    while (col < GRID_SIZE) {
      const startCol = col
      const startIdx = row * GRID_SIZE + col
      const refImage = grid[startIdx].imageIndex
      if (refImage < 0) {
        col++
        continue
      }
      let runLength = 1
      while (
        col + runLength < GRID_SIZE &&
        grid[row * GRID_SIZE + col + runLength].imageIndex === refImage
      ) {
        runLength++
      }
      if (runLength >= 3) {
        const runIndices: number[] = []
        for (let k = 0; k < runLength; k++) {
          runIndices.push(row * GRID_SIZE + startCol + k)
        }
        runIndices.forEach((idx) => matchedIndices.add(idx))

        if (runLength >= 5) {
          const centerIdx = runIndices[Math.floor(runLength / 2)]
          newSpecials.push([centerIdx, SpecialType.RAINBOW])
        } else if (runLength === 4) {
          const centerIdx = runIndices[Math.floor(runLength / 2)]
          newSpecials.push([centerIdx, SpecialType.BOMB])
        }
      }
      col += runLength
    }
  }

  // Vertical runs
  for (let col = 0; col < GRID_SIZE; col++) {
    let row = 0
    while (row < GRID_SIZE) {
      const startRow = row
      const startIdx = row * GRID_SIZE + col
      const refImage = grid[startIdx].imageIndex
      if (refImage < 0) {
        row++
        continue
      }
      let runLength = 1
      while (
        row + runLength < GRID_SIZE &&
        grid[(row + runLength) * GRID_SIZE + col].imageIndex === refImage
      ) {
        runLength++
      }
      if (runLength >= 3) {
        const runIndices: number[] = []
        for (let k = 0; k < runLength; k++) {
          runIndices.push((startRow + k) * GRID_SIZE + col)
        }
        runIndices.forEach((idx) => matchedIndices.add(idx))

        if (runLength >= 5) {
          const centerIdx = runIndices[Math.floor(runLength / 2)]
          // Only add if not already set
          if (!newSpecials.some(([idx]) => idx === centerIdx)) {
            newSpecials.push([centerIdx, SpecialType.RAINBOW])
          }
        } else if (runLength === 4) {
          const centerIdx = runIndices[Math.floor(runLength / 2)]
          if (!newSpecials.some(([idx]) => idx === centerIdx)) {
            newSpecials.push([centerIdx, SpecialType.BOMB])
          }
        }
      }
      row += runLength
    }
  }

  return { indices: matchedIndices, newSpecials }
}

function getNeighborIndices(index: number): number[] {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE
  const neighbors: number[] = []
  if (row > 0) neighbors.push((row - 1) * GRID_SIZE + col)
  if (row < GRID_SIZE - 1) neighbors.push((row + 1) * GRID_SIZE + col)
  if (col > 0) neighbors.push(row * GRID_SIZE + (col - 1))
  if (col < GRID_SIZE - 1) neighbors.push(row * GRID_SIZE + (col + 1))
  return neighbors
}

function get3x3Indices(index: number): number[] {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE
  const result: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
        result.push(nr * GRID_SIZE + nc)
      }
    }
  }
  return result
}

export function processMatches(grid: Tile[], matchResult: MatchResult): Tile[] {
  const { indices, newSpecials } = matchResult
  const toRemove = new Set<number>(indices)

  // Expand with BOMB explosions (3x3 around each BOMB tile in matched set)
  indices.forEach((idx) => {
    if (grid[idx].special === SpecialType.BOMB) {
      get3x3Indices(idx).forEach((ni) => toRemove.add(ni))
    }
  })

  // Expand with RAINBOW: remove all tiles with same imageIndex as neighbor
  indices.forEach((idx) => {
    if (grid[idx].special === SpecialType.RAINBOW) {
      const neighbors = getNeighborIndices(idx)
      if (neighbors.length > 0) {
        // Pick first valid neighbor's imageIndex
        const neighborImages = neighbors
          .map((ni) => grid[ni].imageIndex)
          .filter((img) => img >= 0)
        if (neighborImages.length > 0) {
          const targetImage = neighborImages[0]
          grid.forEach((tile, i) => {
            if (tile.imageIndex === targetImage) {
              toRemove.add(i)
            }
          })
        }
      }
    }
  })

  const newGrid = grid.map((tile, idx) => {
    // Check if this index gets a special tile
    const specialEntry = newSpecials.find(([si]) => si === idx)
    if (specialEntry) {
      const [, specialType] = specialEntry
      return createTile(tile.imageIndex, specialType)
    }
    // Otherwise, remove if in toRemove
    if (toRemove.has(idx)) {
      return createTile(-1)
    }
    return tile
  })

  return newGrid
}

export function dropTiles(grid: Tile[]): Tile[] {
  const newGrid = [...grid]

  for (let col = 0; col < GRID_SIZE; col++) {
    // Collect non-empty tiles in this column (top to bottom)
    const columnTiles: Tile[] = []
    for (let row = 0; row < GRID_SIZE; row++) {
      const tile = newGrid[row * GRID_SIZE + col]
      if (tile.imageIndex >= 0) {
        columnTiles.push(tile)
      }
    }

    // Fill from bottom: existing tiles at bottom, new random tiles at top
    const missing = GRID_SIZE - columnTiles.length
    for (let i = 0; i < missing; i++) {
      columnTiles.unshift(createTile(randomTileIndex()))
    }

    // Write back
    for (let row = 0; row < GRID_SIZE; row++) {
      newGrid[row * GRID_SIZE + col] = columnTiles[row]
    }
  }

  return newGrid
}

export function swapTiles(grid: Tile[], i1: number, i2: number): Tile[] {
  const newGrid = [...grid]
  const tmp = newGrid[i1]
  newGrid[i1] = newGrid[i2]
  newGrid[i2] = tmp
  return newGrid
}

export function findHint(grid: Tile[]): [number, number] | null {
  const adjacent: Array<[number, number]> = []

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = row * GRID_SIZE + col
      // Right neighbor
      if (col < GRID_SIZE - 1) {
        adjacent.push([idx, idx + 1])
      }
      // Down neighbor
      if (row < GRID_SIZE - 1) {
        adjacent.push([idx, idx + GRID_SIZE])
      }
    }
  }

  for (const [i1, i2] of adjacent) {
    const swapped = swapTiles(grid, i1, i2)
    const result = checkMatches(swapped)
    if (result.indices.size >= 3) {
      return [i1, i2]
    }
  }

  return null
}
