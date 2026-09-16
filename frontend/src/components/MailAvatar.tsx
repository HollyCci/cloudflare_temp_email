import { Avatar } from '@heroui/react'
import { avatarFor, getInitials } from '../utils/mail'

export function MailAvatar({
  seed,
  name,
  portrait = false,
  className = 'size-9 shrink-0',
}: {
  seed: string
  name?: string
  portrait?: boolean
  className?: string
}) {
  const label = name || seed
  return (
    <Avatar className={className} color="default" variant={portrait ? undefined : 'soft'}>
      {portrait ? <Avatar.Image alt={label} src={avatarFor(seed)} /> : null}
      <Avatar.Fallback>{getInitials(label)}</Avatar.Fallback>
    </Avatar>
  )
}
