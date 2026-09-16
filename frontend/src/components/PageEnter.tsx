import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export const enterEase = [0.22, 1, 0.36, 1] as const
export const enterDuration = 0.28

export function useWideLayout(query = '(min-width: 1024px)') {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setWide(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return wide
}

export function PageEnter({
  children,
  className,
  scene,
}: {
  children: ReactNode
  className?: string
  scene?: string
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      key={scene}
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      transition={{ duration: enterDuration, ease: enterEase }}
    >
      {children}
    </motion.div>
  )
}
