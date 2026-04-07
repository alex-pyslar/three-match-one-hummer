import React from 'react'

interface ScorePopupProps {
  score: number
}

/**
 * Floating "+N" score popup that animates upward and fades out.
 * Use a changing `key` prop to re-trigger the animation on each gain.
 */
const ScorePopup: React.FC<ScorePopupProps> = ({ score }) => {
  if (!score) return null
  return (
    <div className="score-popup" aria-hidden="true">
      +{score}
    </div>
  )
}

export default ScorePopup
