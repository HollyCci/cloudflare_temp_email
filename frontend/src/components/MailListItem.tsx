import { useRef } from 'react'
import { Description } from '@heroui/react'
import { usePress } from '@react-aria/interactions'
import type { Mail } from '../store/types'
import { compactTime, mailPreview, parseSender } from '../utils/mail'
import { useI18n } from '../i18n'
import { MailAvatar } from './MailAvatar'

export function MailListItem({
  mail,
  isActive,
  onSelect,
}: {
  mail: Mail
  isActive: boolean
  onSelect: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLButtonElement>(null)
  const { pressProps } = usePress({ onPress: () => onSelect(), ref })
  const sender = parseSender(mail.sender || mail.source)
  const unread = mail.is_unread === 1
  const className = `relative flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
    isActive ? 'bg-surface shadow-surface' : 'hover:bg-default/60'
  }`

  return (
    <li>
      <button
        {...pressProps}
        ref={ref}
        aria-current={isActive ? 'page' : undefined}
        className={className}
        type="button"
      >
        <MailAvatar name={sender.name} seed={sender.email || sender.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm leading-tight ${unread ? 'text-foreground font-medium' : 'text-foreground'}`}>
              {sender.name}
            </span>
            <div className="flex items-center gap-2">
              <span className={`whitespace-nowrap text-xs leading-tight ${unread ? 'text-foreground font-medium' : 'text-muted'}`}>
                {compactTime(mail.created_at)}
              </span>
              {unread ? <span aria-hidden className="bg-accent size-1.5 shrink-0 rounded-full" /> : null}
            </div>
          </div>
          <Description className={`truncate text-xs leading-tight ${unread ? 'text-foreground font-medium' : 'text-muted'}`}>
            {mail.subject || t('noSubject')}
          </Description>
          <Description className="text-muted truncate text-xs leading-tight">
            {mailPreview(mail)}
          </Description>
        </div>
      </button>
    </li>
  )
}
