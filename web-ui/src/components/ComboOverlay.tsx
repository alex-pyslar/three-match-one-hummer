import React from 'react'

interface ComboOverlayProps {
  combo: number
  show: boolean
}

/**
 * Full-screen fixed overlay that displays a combo multiplier.
 * Uses `key` prop at the call site to re-trigger the animation on each new
 * combo level (see GameBoard.tsx).
 */
const ComboOverlay: React.FC<ComboOverlayProps> = ({ combo, show }) => {
  if (!show || combo < 2) return null

  return (
    <div className="combo-overlay" aria-live="assertive" aria-atomic="true">
      <span className="combo-overlay__label">КОМБО</span>
      <span className="combo-overlay__mult">×{combo}</span>
      <span className="combo-overlay__bang">!</span>
    </div>
  )
}

export default ComboOverlay
