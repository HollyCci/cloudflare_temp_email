import { Avatar, Description } from '@heroui/react'
import type { Mail } from '../store/types'
import { compactTime, getInitials, mailPreview, parseSender } from '../utils/mail'
import { useI18n } from '../i18n'

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
  const sender = parseSender(mail.sender || mail.source)
  const unread = mail.is_unread === 1
  const className = `relative flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
    isActive ? 'bg-surface shadow-surface' : 'hover:bg-default/60'
  }`

  return (
    <li>
      <button
        aria-current={isActive ? 'page' : undefined}
        className={className}
        type="button"
        onClick={onSelect}
      >
        <Avatar className="size-9 shrink-0">
          <Avatar.Fallback>{getInitials(sender.name)}</Avatar.Fallback>
        </Avatar>
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
