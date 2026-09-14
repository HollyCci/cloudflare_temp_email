import { ArrowRotateRight } from '@gravity-ui/icons'
import { Button, ScrollShadow, SearchField, Tooltip } from '@heroui/react'
import { AppLayout } from '@heroui-pro/react'
import type { Mail } from '../store/types'
import { useI18n } from '../i18n'
import { MailListItem } from './MailListItem'

export function MailList({
  mails,
  query,
  selectedId,
  onQueryChange,
  onRefresh,
  onSelect,
}: {
  mails: Mail[]
  query: string
  selectedId: string
  onQueryChange: (value: string) => void
  onRefresh: () => void
  onSelect: (id: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-clip px-2 pb-2 pt-4">
      <div className="flex items-center gap-2">
        <AppLayout.MenuToggle className="ml-0" />
        <SearchField
          aria-label={t('searchMail')}
          className="flex-1"
          name="folder-search"
          value={query}
          onChange={onQueryChange}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t('searchPlaceholder')} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly aria-label={t('refresh')} size="sm" variant="ghost" onPress={onRefresh}>
              <ArrowRotateRight className="size-4" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t('refresh')}</Tooltip.Content>
        </Tooltip>
      </div>

      <ScrollShadow hideScrollBar className="min-h-0 flex-1 overflow-y-auto">
        {mails.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <p className="text-foreground text-sm font-medium">{t('noConversations')}</p>
            <p className="text-muted max-w-[220px] text-xs">{t('noConversationsHint')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {mails.map((mail) => (
              <MailListItem
                key={String(mail.id)}
                isActive={String(mail.id) === selectedId}
                mail={mail}
                onSelect={() => onSelect(String(mail.id))}
              />
            ))}
          </ul>
        )}
      </ScrollShadow>
    </div>
  )
}
