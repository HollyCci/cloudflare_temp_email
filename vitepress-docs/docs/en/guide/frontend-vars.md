# Frontend Variables

Frontend configuration is public in the browser. Do not put passwords, API keys, or other secrets in these values.

## Configuration Methods

### ENV

For CLI deployment, add the variables to `frontend/.env.prod`. For Worker Assets or Page Functions deployment, use `frontend/.env.pages.local`. For the GitHub Actions `Deploy Frontend` workflow, put the same content in the `FRONTEND_ENV` repository secret. The `Deploy Frontend with page function` workflow does not read this secret.

```ini
VITE_API_BASE=https://temp-email-api.example.com
```

See [CLI Deployment](/en/guide/cli/pages) and [GitHub Actions Deployment](/en/guide/actions/github-action) for complete steps.

### index.html

When using a prebuilt frontend ZIP, edit `app-config` in `index.html`. Field names do not use the `VITE_` prefix:

```html
<script id="app-config" type="application/json">
{
  "API_BASE": "https://temp-email-api.example.com"
}
</script>
```

Fields set in `app-config` override ENV build values. Omitted fields, or a missing `app-config` tag, continue to use ENV build values. See [Manual ZIP Deployment](/en/guide/ui/pages) for complete steps.

## Variable Reference

No frontend variable is required for every deployment method. `VITE_API_BASE` is required only when the frontend and backend are deployed separately and the browser must request the Worker domain directly. Leave it empty for same-origin deployments such as Worker Assets or Page Functions.

| ENV Variable | `app-config` Field | Required | Type | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `VITE_API_BASE` | `API_BASE` | Depends on deployment | Text | Empty | Backend API root URL beginning with `https://` and without a trailing `/`; an empty value uses the same-origin API |
| `VITE_CF_WEB_ANALY_TOKEN` | `CF_WEB_ANALY_TOKEN` | No | Text | Empty | Cloudflare Web Analytics Token |

## Removed Variables

The frontend has not read these variables since v1.13.0, so setting them has no effect. You can delete them from existing configurations (ENV or `app-config`):

| ENV Variable | `app-config` Field | Notes |
| --- | --- | --- |
| `VITE_DEFAULT_LANG` | `DEFAULT_LANG` | The frontend UI is Chinese only. The `DEFAULT_LANG` [Worker variable](/en/guide/worker-vars) is a separate setting and is unaffected |
| `VITE_IS_TELEGRAM` | `IS_TELEGRAM` | The Telegram Mini App has been removed; bot commands and mail push are unaffected. See [Telegram Bot](/en/guide/feature/telegram) |
| `VITE_GOOGLE_AD_CLIENT`, `VITE_GOOGLE_AD_SLOT` | `GOOGLE_AD_CLIENT`, `GOOGLE_AD_SLOT` | Google Ads has been removed |
