import { useCallback, useEffect, useRef } from 'react'

const COMPACT_VIEWPORT = '(max-width: 1023px)'
const GHOST_CLICK_WINDOW_MS = 400

type Blocker = (event: Event) => void

// iOS synthesizes the click by hit-testing the touch coordinates *after* our
// list/detail layout swap, so it lands on whatever now sits under the finger.
// `arm()` swallows any click on compact viewports for a short window.
export function useGhostClickGuard() {
  const blocker = useRef<Blocker | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | 0>(0)

  const disarm = useCallback(() => {
    if (blocker.current) document.removeEventListener('click', blocker.current, true)
    if (timer.current) window.clearTimeout(timer.current)
    blocker.current = null
    timer.current = 0
  }, [])

  useEffect(() => disarm, [disarm])

  return useCallback(() => {
    if (!window.matchMedia(COMPACT_VIEWPORT).matches) return
    disarm()
    const block: Blocker = (event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    blocker.current = block
    document.addEventListener('click', block, true)
    timer.current = window.setTimeout(() => {
      document.removeEventListener('click', block, true)
      if (blocker.current === block) blocker.current = null
      timer.current = 0
    }, GHOST_CLICK_WINDOW_MS)
  }, [disarm])
}
