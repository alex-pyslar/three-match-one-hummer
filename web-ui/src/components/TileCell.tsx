import React, { useRef, useCallback } from 'react'
import { Tile, SpecialType, SwipeDirection } from '../types'

interface TileCellProps {
  tile: Tile
  isHint: boolean
  index: number
  onSwipe: (direction: SwipeDirection) => void
}

const TILE_IMAGES = [
  '/assets/note1.png',
  '/assets/note2.png',
  '/assets/note3.png',
  '/assets/note4.png',
  '/assets/note5.png',
]

const SWIPE_THRESHOLD = 30

const TileCell: React.FC<TileCellProps> = ({ tile, isHint, index, onSwipe }) => {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasSwipedRef = useRef(false)
  const elementRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    hasSwipedRef.current = false
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerStartRef.current || hasSwipedRef.current) return

      const dx = e.clientX - pointerStartRef.current.x
      const dy = e.clientY - pointerStartRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return

      hasSwipedRef.current = true
      pointerStartRef.current = null

      let direction: SwipeDirection
      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left'
      } else {
        direction = dy > 0 ? 'down' : 'up'
      }

      onSwipe(direction)
    },
    [onSwipe]
  )

  const handlePointerUp = useCallback(() => {
    pointerStartRef.current = null
    hasSwipedRef.current = false
  }, [])

  if (tile.imageIndex < 0) {
    return <div className="tile-cell tile-cell--empty" />
  }

  const isBomb = tile.special === SpecialType.BOMB
  const isRainbow = tile.special === SpecialType.RAINBOW

  let cellClassName = 'tile-cell'
  if (isBomb) cellClassName += ' tile-cell--bomb'
  else if (isRainbow) cellClassName += ' tile-cell--rainbow'
  if (isHint) cellClassName += ' tile-cell--hint'

  return (
    <div
      ref={elementRef}
      className={cellClassName}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none', userSelect: 'none' }}
      data-index={index}
    >
      <img
        src={TILE_IMAGES[tile.imageIndex]}
        alt={`tile-${tile.imageIndex + 1}`}
        className="tile-image"
        draggable={false}
      />
      {isBomb && (
        <span className="tile-badge tile-badge--bomb" aria-label="bomb">
          💣
        </span>
      )}
      {isRainbow && (
        <span className="tile-badge tile-badge--rainbow" aria-label="rainbow">
          🌈
        </span>
      )}
    </div>
  )
}

export default React.memo(TileCell)
