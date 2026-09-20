# Admin Console

> [!NOTE]
> The Admin Console uses role-based access control (RBAC); there is no separate admin password.
> Only signed-in user accounts whose role equals `ADMIN_USER_ROLE` (default `admin`) can open it.

After deploying the frontend, sign in with an admin account and the **Admin** entry appears in the sidebar; you can also visit `/admin` directly. Guests are asked to sign in first, and signed-in users without the admin role see an access-denied message.

## Becoming an Admin

1. **Bootstrap the first admin**: set the `ADMIN_USER_EMAILS` Worker variable, e.g. `["admin@example.com"]`. Listed accounts are granted the admin role automatically after registering and signing in (they may register even while user registration is disabled).
2. **Add more admins**: open **Admin Console → Users** and assign the role matching `ADMIN_USER_ROLE` to the target user; clearing the role revokes admin access.

`ADMIN_USER_ROLE` defaults to `admin`. The role is always included in the assignable role list, so you do not need to repeat it in `USER_ROLES`. If you do declare a role with the same name in `USER_ROLES`, its domains and prefix apply to admins as well.

## Admin Accounts vs Mailboxes

An admin is a site **user account** (the `users` table) holding the admin role, not a mailbox. Whether a user can receive mail depends on whether they created or bound a mailbox. A mailbox named `admin@example.com` does not grant console access by itself; only accounts listed in `ADMIN_USER_EMAILS` or assigned the admin role can enter the console.

## Calling Admin APIs from Scripts

Every `/admin/*` endpoint is authenticated with the `x-user-access-token` header, whose `user_role` claim must equal `ADMIN_USER_ROLE`. To obtain a token:

- **With an admin account**: call `POST /user_api/login` to get a user JWT, then request `GET /user_api/settings` with `x-user-token`. The returned `access_token` is the admin access token (valid for 1 hour; the frontend refreshes it automatically).
- **For automation**: sign an HS256 JWT with `JWT_SECRET` whose payload looks like `{"user_role": "admin", "exp": <expiry timestamp>}`; `exp` is required.

```python
import requests

headers = {
    "x-user-access-token": "<admin access token>",
    # "x-custom-auth": "<your site password>",  # if the private site password is enabled
}
print(requests.get("https://<your-worker-domain>/admin/mails?limit=20&offset=0", headers=headers).json())
```

When `ADMIN_API_IP_WHITELIST` is configured, the source IP must also be whitelisted.

![admin](/feature/admin.png)

## Mailbox List Sorting

**Admin Console → Mailbox Management → Mailboxes** supports column sorting. Click a column header to toggle ascending/descending order for:

- ID
- Email Address
- Created At
- Updated At
- Mail Count
- Send Count

When searching for email addresses, pagination automatically resets to page 1.

## User Management

**Admin Console → Users** lists and searches every user account, assigns or clears roles (including the admin role), creates new users, and deletes users.

## IP Blacklist / Whitelist

Configure access control in Admin Console → **IP Blacklist Settings**. Applies to: create address, send mail, external send mail API, user registration, and verify code endpoints.

### IP Whitelist (Strict Mode)

When enabled, **only** whitelisted IPs can access protected endpoints; all others receive 403.

- Plain entries: exact match (no substring), e.g. `1.2.3.4`
- Regex entries: use anchored patterns, e.g. `^192\.168\.1\.\d+$`
- Whitelisted IPs skip blacklist checks
- If whitelist is enabled but the list is empty, the server ignores the switch (fail-open to prevent lockout)

### IP Blacklist

When enabled, matching IPs receive 403. Supports substring text matching or regex.

### ASN Organization Blacklist

Block by ISP/provider name, case-insensitive. Supports text or regex matching.

### Browser Fingerprint Blacklist

Block by `x-fingerprint` request header. Supports exact or regex matching.

### Daily Request Limit

Limit the maximum number of requests per IP per day (1–1,000,000). Exceeding the limit returns 429. Counter resets every 24 hours (UTC date boundary).
