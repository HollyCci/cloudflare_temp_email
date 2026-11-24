import type { Components } from 'react-markdown'
import { Markdown } from '@heroui-pro/react/markdown'
import { CodeBlock } from '@heroui-pro/react/code-block'
import { AppShell, PageHeader } from '../components/AppShell'
import { PageEnter } from '../components/PageEnter'
import { APP_CONFIG } from '../config'
import { useI18n } from '../i18n'

const apiBase = () => (APP_CONFIG.API_BASE || window.location.origin).replace(/\/$/, '')

function languageOf(className?: string) {
  return className?.match(/language-(\w+)/)?.[1] ?? 'plaintext'
}

export function DocsPage() {
  const { t } = useI18n()
  const base = apiBase()
  const header = '-H "Authorization: Bearer <凭证>"'
  const source = `# 凭证只打开这一只邮箱

「复制凭证」得到的是地址 JWT，不是邮箱地址，也不是账户密码。把它放在请求头 \`Authorization: Bearer <凭证>\` 里，就能查看、删除这只邮箱的信，并在有额度时用它发信。它进不了管理后台。

接口根地址是 \`${base}\`。不要把凭证放到 \`x-user-token\`（那是登录账户）或 \`x-user-access-token\`（那是管理员）里，放错会返回 401。

## 确认这只邮箱

\`GET ${base}/api/settings\`

返回 \`address\` 和剩余发信额度。401 表示凭证无效。

\`\`\`bash
curl -s ${base}/api/settings \\
  ${header}
\`\`\`

## 列出邮件

\`GET ${base}/api/parsed_mails?limit=20&offset=0\`

结果里有主题、正文和发件人。limit 为 1 到 100。

\`\`\`bash
curl -s "${base}/api/parsed_mails?limit=20&offset=0" \\
  ${header}
\`\`\`

## 读一封

\`GET ${base}/api/parsed_mail/<id>\`

把列表里的 id 换进去。

\`\`\`bash
curl -s ${base}/api/parsed_mail/<id> \\
  ${header}
\`\`\`

## 用这只邮箱发信

\`POST ${base}/api/send_mail\`

需要这只地址还有发信额度，否则会返回没有余额。

\`\`\`bash
curl -s -X POST ${base}/api/send_mail \\
  ${header} \\
  -H "Content-Type: application/json" \\
  -d '{"to_mail":"someone@example.com","subject":"hi","content":"hello","is_html":false}'
\`\`\`
`

  const components: Partial<Components> = {
    code({ children, className, node }) {
      const start = node?.position?.start.line
      const end = node?.position?.end.line
      if (!start || start === end) {
        return <code className="markdown__inline-code">{children}</code>
      }
      const language = languageOf(className)
      const code = String(children ?? '').replace(/\n$/, '')
      return (
        <CodeBlock className="max-w-full">
          <CodeBlock.Header>
            <span className="text-muted text-xs uppercase">{language}</span>
            <CodeBlock.CopyButton aria-label={t('copySample')} code={code} />
          </CodeBlock.Header>
          <CodeBlock.Code code={code} language={language} />
        </CodeBlock>
      )
    },
    pre({ children }) {
      return <>{children}</>
    },
  }

  return (
    <AppShell>
      <div className="flex h-svh min-w-0 flex-col overflow-hidden">
        <PageHeader title={t('apiDocs')} />
        <PageEnter className="mx-auto w-full min-w-0 max-w-3xl flex-1 overflow-auto px-6 pt-6 pb-16">
          <Markdown className="max-w-full [&_.markdown__inline-code]:[overflow-wrap:anywhere]" components={components}>{source}</Markdown>
        </PageEnter>
      </div>
    </AppShell>
  )
}
