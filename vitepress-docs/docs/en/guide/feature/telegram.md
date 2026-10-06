# Configure Telegram Bot

Try it here: [@cf_temp_mail_bot](https://t.me/cf_temp_mail_bot)

::: warning Note
The default `worker.dev` domain certificate for worker is not supported by Telegram. Please use a custom domain when configuring Telegram Bot.
:::

> [!NOTE]
> If you want to use Telegram Bot, please bind `KV` first
>
> If you don't need Telegram Bot, you can skip this step
>
> If you want Telegram to have stronger email parsing capabilities, refer to [Configure worker to use wasm for email parsing](/en/guide/feature/mail_parser_wasm_worker)

## Telegram Bot Configuration

Please first create a Telegram Bot, obtain the `token`, then execute the following command to add the `token` to secrets

> [!NOTE]
> If you find it troublesome, you can also put it in plain text under `[vars]` in `wrangler.toml`, but this is not recommended

If you deployed via UI, you can add it under `Variables and Secrets` in the Cloudflare UI interface

```bash
# Switch to worker directory
cd worker
pnpm wrangler secret put TELEGRAM_BOT_TOKEN
```

## Bot

- Can set whitelist users
- Click `Initialize` to complete the configuration.
- Click `View Status` to check the current configuration status.

![telegram](/feature/telegram.png)

## Language Switching

> [!NOTE]
> This feature is available since v1.2.0

Telegram Bot supports Chinese and English switching. Users can set their language preference via the `/lang` command.

### Enable Language Switching

You need to configure `TG_ALLOW_USER_LANG = true` in worker variables to enable this feature.

### Usage

- `/lang zh` - Switch to Chinese
- `/lang en` - Switch to English
- `/lang` - View current language setting

Language preferences are saved to KV, and each user can set their preference independently.

## Per-User Mail Push

Telegram Bot supports **per-user push notifications**. After a user binds an address, emails received at that address are automatically pushed to the corresponding user.

### User Workflow

1. Find your deployed Bot in Telegram
2. Use `/new [name@domain]` to create a new address, or `/bind <credential>` to bind an existing address
3. Once bound, you will **automatically receive push notifications** when the address receives mail
4. Use `/address` to view your bound addresses
5. Use `/unbind <address>` to unbind an address

> [!TIP]
> Each user can bind up to `TG_MAX_ADDRESS` (default 5) addresses

### Global Push

Admins can enable **global mail push** in the admin panel under `Settings` -> `Telegram`, pushing all emails to a specified list of Telegram user IDs.

- `enableGlobalMailPush`: Enable global push
- `globalMailPushList`: List of Telegram user IDs to receive global push

> [!NOTE]
> Global push and per-user push can work simultaneously. If an address is bound to a user who is also in the global push list, they will receive two notifications.

### Attachment Push

> [!NOTE]
> This feature is available since v1.5.0

Set `ENABLE_TG_PUSH_ATTACHMENT = true` to enable sending email attachments via Telegram push.

- Single file size limit is 50MB (Telegram Bot API limit), oversized attachments are skipped
- Multiple attachments are sent in batches via `sendMediaGroup`, up to 6 per batch
- The first attachment includes the sender and subject as caption

## Mini App (Removed)

The Telegram Mini App has been removed. The frontend has had no Mini App pages since the React rewrite in v1.13.0, and the Worker's Mini App API (`/telegram/get_bind_address` and related endpoints) and the "View Mail" button on mail messages are now removed as well. Bot commands and mail push are unaffected.

If you deployed the Mini App before, you can:

- Delete the Pages project created for the Mini App, and the `TG_FRONTEND_NAME` and `USE_WORKER_ASSETS_WITH_TELEGRAM` secrets in GitHub Actions
- Remove the Mini App entry you configured with `/setmenubutton` or `/newapp` in `@BotFather`
