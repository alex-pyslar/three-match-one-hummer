import { useEffect, useRef } from 'react'

// ── Particle images ───────────────────────────────────────────────────────────
const BG_IMAGES = [
  '/assets/bg_picture1.png',
  '/assets/bg_picture2.png',
  '/assets/bg_picture3.png',
  '/assets/bg_picture4.png',
  '/assets/bg_picture5.png',
]

interface Particle {
  id: number
  /** Horizontal position in viewport-width percent (0–100) */
  xPct: number
  /** Vertical position in pixels from top */
  yPx: number
  /** Current rotation in degrees */
  rotation: number
  /** Fall speed in px/frame (at 60fps) */
  speed: number
  /** Rotation delta per frame */
  rotSpeed: number
  /** Size in pixels */
  size: number
  /** Which image to use */
  imgSrc: string
  /** Opacity 0–1 */
  opacity: number
}

let _nextId = 0

function makeParticle(screenH: number, scatter = false): Particle {
  return {
    id: _nextId++,
    xPct: Math.random() * 105 - 2,          // slightly off-screen sides too
    yPx: scatter ? Math.random() * screenH : -60 - Math.random() * 120,
    rotation: Math.random() * 360,
    speed: 0.45 + Math.random() * 0.9,      // 0.45–1.35 px/frame
    rotSpeed: (Math.random() - 0.5) * 1.8,  // –0.9 to +0.9 deg/frame
    size: 22 + Math.random() * 34,          // 22–56 px
    imgSrc: BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)],
    opacity: 0.45 + Math.random() * 0.35,   // 0.45–0.8
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const MAX_PARTICLES = 70
const SPAWN_INTERVAL_FRAMES = 6  // spawn one every N frames

const FallingParticles: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef  = useRef<Particle[]>([])
  const rafRef        = useRef<number>(0)
  const frameRef      = useRef<number>(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const vh = window.innerHeight

    // Pre-seed so the screen isn't empty on load
    for (let i = 0; i < 30; i++) {
      particlesRef.current.push(makeParticle(vh, true))
    }

    // Build a DOM element pool — create once, reuse, hide when unused
    const pool: HTMLDivElement[] = []
    function getPoolEl(): HTMLDivElement {
      const el = document.createElement('div')
      el.className = 'fp'
      const img = document.createElement('img')
      img.alt = ''
      img.draggable = false
      el.appendChild(img)
      container!.appendChild(el)
      pool.push(el)
      return el
    }

    // Map particle.id → DOM element
    const elMap = new Map<number, HTMLDivElement>()

    const animate = () => {
      frameRef.current++
      const h = window.innerHeight

      // Spawn
      if (
        particlesRef.current.length < MAX_PARTICLES &&
        frameRef.current % SPAWN_INTERVAL_FRAMES === 0
      ) {
        particlesRef.current.push(makeParticle(h))
      }

      // Update & cull off-screen particles
      const alive: Particle[] = []
      for (const p of particlesRef.current) {
        p.yPx      += p.speed
        p.rotation += p.rotSpeed
        if (p.yPx < h + 80) {
          alive.push(p)
        } else {
          // Return DOM element to hidden state
          const el = elMap.get(p.id)
          if (el) {
            el.style.display = 'none'
            elMap.delete(p.id)
          }
        }
      }
      particlesRef.current = alive

      // Sync DOM
      for (const p of alive) {
        let el = elMap.get(p.id)
        if (!el) {
          // Reuse a hidden element from the pool if available
          const reusable = pool.find(e => e.style.display === 'none' && !elMap.has(parseInt(e.dataset.pid ?? '-1', 10)))
          el = reusable ?? getPoolEl()
          el.dataset.pid = String(p.id)
          el.style.display = ''
          ;(el.firstElementChild as HTMLImageElement).src = p.imgSrc
          elMap.set(p.id, el)
        }
        el.style.cssText =
          `left:${p.xPct}%;` +
          `top:${p.yPx}px;` +
          `width:${p.size}px;height:${p.size}px;` +
          `opacity:${p.opacity};` +
          `transform:rotate(${p.rotation}deg);` +
          `display:block;`
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    />
  )
}

export default FallingParticles
