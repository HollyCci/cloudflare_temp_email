import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Spinner, type ButtonProps } from '@heroui/react'
import { Check } from '@gravity-ui/icons'

const MIN_PENDING_MS = 280
const SUCCESS_MS = 720

type ActionResult = void | boolean | Promise<void | boolean>

export function ActionButton({
  children,
  confirm = false,
  onPress,
  ...props
}: Omit<ButtonProps, 'onPress' | 'isPending' | 'children'> & {
  children?: ReactNode
  confirm?: boolean
  onPress: () => ActionResult
}) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | 0>(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const handlePress = async () => {
    if (status !== 'idle') return
    const started = Date.now()
    setStatus('pending')
    try {
      const result = await onPress()
      if (result === false) {
        setStatus('idle')
        return
      }
      const wait = MIN_PENDING_MS - (Date.now() - started)
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait))
      if (!confirm) {
        setStatus('idle')
        return
      }
      setStatus('success')
      timer.current = window.setTimeout(() => setStatus('idle'), SUCCESS_MS)
    } catch {
      setStatus('idle')
    }
  }

  return (
    <Button {...props} isPending={status === 'pending'} onPress={() => void handlePress()}>
      {({ isPending }) => {
        const icon = isPending ? (
          <Spinner color="current" size="sm" />
        ) : status === 'success' ? (
          <Check className="size-4" />
        ) : null

        if (props.isIconOnly) {
          return icon ?? children
        }

        return (
          <>
            {icon}
            {children}
          </>
        )
      }}
    </Button>
  )
}
