import { ArrowLeft, ArrowRight, ChevronLeft, TrashBin, Tray, Xmark } from '@gravity-ui/icons'
import { Avatar, Button, ScrollShadow, Tooltip } from '@heroui/react'
import type { Mail } from '../store/types'
import { useI18n } from '../i18n'
import { compactTime, getInitials, parseSender } from '../utils/mail'
import { ActionButton } from './ActionButton'
import { MailHtml } from './MailHtml'

export function MailDetail({
  mail,
  isDark,
  allowRemote,
  canDelete,
  index,
  total,
  onBack,
  onDelete,
  onPrev,
  onNext,
}: {
  mail: Mail
  isDark: boolean
  allowRemote: boolean
  canDelete: boolean
  index: number
  total: number
  onBack: () => void
  onDelete: () => void | Promise<void>
  onPrev: () => void
  onNext: () => void
}) {
  const { t } = useI18n()
  const sender = parseSender(mail.sender || mail.source)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-clip lg:py-4 lg:pl-0.5 lg:pr-4">
      <div className="lg:bg-surface lg:shadow-surface flex max-h-full flex-1 flex-col gap-6 overflow-clip p-4 lg:rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              aria-label={t('backToList')}
              className="border-border text-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-full border transition-colors lg:hidden"
              type="button"
              onClick={onBack}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              aria-label={t('close')}
              className="bg-default text-muted hover:bg-default-hover hidden size-6 shrink-0 items-center justify-center rounded-xl transition-colors lg:inline-flex"
              type="button"
              onClick={onBack}
            >
              <Xmark className="size-4" />
            </button>
            {canDelete ? (
              <Tooltip>
                <Tooltip.Trigger>
                  <ActionButton
                    isIconOnly
                    aria-label={t('delete')}
                    className="text-muted hover:text-foreground"
                    size="sm"
                    variant="ghost"
                    onPress={onDelete}
                  >
                    <TrashBin className="size-4" />
                  </ActionButton>
                </Tooltip.Trigger>
                <Tooltip.Content>{t('delete')}</Tooltip.Content>
              </Tooltip>
            ) : null}
          </div>
          <div className="flex items-center gap-4 px-2">
            <span className="text-muted text-xs tabular-nums">
              {index + 1} / {total}
            </span>
            <div className="flex items-center">
              <Button
                isIconOnly
                aria-label={t('previous')}
                className="text-muted hover:text-foreground"
                isDisabled={index <= 0}
                size="sm"
                variant="ghost"
                onPress={onPrev}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Button
                isIconOnly
                aria-label={t('next')}
                className="text-muted hover:text-foreground"
                isDisabled={index >= total - 1}
                size="sm"
                variant="ghost"
                onPress={onNext}
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollShadow hideScrollBar className="min-h-0 flex-1 overflow-y-auto lg:px-6">
          <div className="flex flex-col gap-8 pb-5">
            <h1 className="text-foreground text-base font-semibold leading-normal">
              {mail.subject || t('noSubject')}
            </h1>
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <Avatar className="size-9 shrink-0">
                  <Avatar.Fallback>{getInitials(sender.name)}</Avatar.Fallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-foreground text-sm font-medium leading-tight">{sender.name}</span>
                  {sender.email ? (
                    <span className="text-muted text-xs font-medium leading-tight">{sender.email}</span>
                  ) : null}
                  <p className="text-muted text-xs font-medium leading-tight">{t('toMe')}</p>
                </div>
              </div>
              <span className="text-muted whitespace-nowrap text-xs">{compactTime(mail.created_at)}</span>
            </div>
            {mail.html || mail.message ? (
              <MailHtml allowRemote={allowRemote} html={mail.html || mail.message || ''} isDark={isDark} />
            ) : (
              <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {mail.text || ''}
              </div>
            )}
          </div>
        </ScrollShadow>
      </div>
    </div>
  )
}

export function MailEmpty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="bg-surface shadow-surface flex size-12 items-center justify-center rounded-2xl">
        <Tray className="text-muted size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-base font-semibold">{t('nothingOpen')}</h2>
        <p className="text-muted max-w-[320px] text-sm">{t('nothingOpenHint')}</p>
      </div>
    </div>
  )
}
