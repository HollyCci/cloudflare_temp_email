import { Context, Hono } from 'hono'
import { cors } from 'hono/cors';
import { addressJwtAuth } from './address_auth';
import {
	applyUserIdentity, applyUserRole, checkAdminApiIpWhitelist, requireAdminRole,
} from './user_auth';

import { api as commonApi } from './commom_api';
import { api as openAuthApi } from './open_api/auth';
import { api as mailsApi } from './mails_api'
import { api as userApi } from './user_api';
import { api as adminApi } from './admin_api';
import { api as apiSendMail } from './mails_api/send_mail_api'
import { api as telegramApi } from './telegram_api'
import { api as redeemApi } from './redeem_api'

import i18n from './i18n';
import { ErrorCode } from './error_codes';
import { email } from './email';
import { scheduled } from './scheduled';
import { getPasswords, getBooleanValue, getDomains } from './utils';
import { checkAccessControl } from './ip_blacklist';

const API_PATHS = [
	"/api/",
	"/open_api/",
	"/user_api/",
	"/admin/",
	"/telegram/",
	"/external/",
	"/redeem_api/",
];

const app = new Hono<HonoCustomType>()
//cors
app.use('/*', cors());
// error handler
app.onError((err, c) => {
	console.error(err)
	return c.json({ code: ErrorCode.INTERNAL_SERVER_ERROR, message: `${err.name} ${err.message}` }, 500)
})
// global middlewares
app.use('/*', async (c, next) => {

	// check if the request is for static files
	if (c.env.ASSETS && !API_PATHS.some(path => c.req.path.startsWith(path))) {
		const url = new URL(c.req.raw.url);
		if (!url.pathname.includes('.')) {
			url.pathname = ""
		}
		return c.env.ASSETS.fetch(url);
	}

	// save language in context
	const lang = c.req.raw.headers.get("x-lang");
	if (lang) { c.set("lang", lang); }
	const msgs = i18n.getMessages(lang || c.env.DEFAULT_LANG);

	// check header x-custom-auth
	const passwords = getPasswords(c);
	if (!c.req.path.startsWith("/open_api")
		&& !c.req.path.startsWith("/telegram/")
		&& passwords && passwords.length > 0
	) {
		const auth = c.req.raw.headers.get("x-custom-auth");
		if (!auth || !passwords.includes(auth)) {
			return c.json({ code: ErrorCode.AUTH_SITE_PASSWORD_INVALID, message: msgs.CustomAuthPasswordMsg }, 401)
		}
	}

	// rate limit for specific endpoints
	if (
		c.req.path.startsWith("/api/new_address")
		|| c.req.path.startsWith("/api/send_mail")
		|| c.req.path.startsWith("/external/api/send_mail")
		|| (c.req.path.startsWith("/user_api/address/") && c.req.path.endsWith("/send_mail"))
		|| c.req.path.startsWith("/user_api/register")
		|| c.req.path.startsWith("/user_api/verify_code")
		|| c.req.path.startsWith("/redeem_api/")
	) {
		const reqIp = c.req.raw.headers.get("cf-connecting-ip")
		if (reqIp && c.env.RATE_LIMITER) {
			const { success } = await c.env.RATE_LIMITER.limit(
				{ key: `${c.req.path}|${reqIp}` }
			)
			if (!success) {
				return c.text(`IP=${reqIp} Rate limit exceeded for ${c.req.path}`, 429)
			}
		}
		// Check access control (blacklist and daily limit)
		const accessControlResponse = await checkAccessControl(c);
		if (accessControlResponse) {
			return accessControlResponse;
		}
	}
	// webhook check
	if (
		c.req.path.startsWith("/api/webhook")
		|| c.req.path.startsWith("/admin/webhook")
		|| c.req.path.startsWith("/admin/mail_webhook")
	) {
		if (!c.env.KV) {
			return c.text(msgs.KVNotAvailableMsg, 400);
		}
		if (!getBooleanValue(c.env.ENABLE_WEBHOOK)) {
			return c.text(msgs.WebhookNotEnabledMsg, 403);
		}
	}
	if (!c.env.DB) {
		return c.text(msgs.DBNotAvailableMsg, 400);
	}
	if (!c.env.JWT_SECRET) {
		return c.text(msgs.JWTSecretNotSetMsg, 400);
	}
	await next()
});

/** Paths under `/user_api/` that must stay reachable without an account. */
const PUBLIC_USER_API_PATHS = [
	"/user_api/open_settings",
	"/user_api/register",
	"/user_api/login",
	"/user_api/verify_code",
	"/user_api/passkey/authenticate_",
	"/user_api/oauth2",
];

// api auth: an address credential, plus the caller's role when one is presented
app.use('/api/*', async (c, next) => {
	// creating an address is open to anonymous callers, and reads the account when there is one
	if (c.req.path.startsWith("/api/new_address")) {
		const identityResponse = await applyUserIdentity(c, { required: false });
		if (identityResponse) return identityResponse;
		// the quota and the allowed domains come from the role, so it must be the caller's own
		const roleResponse = await applyUserRole(c, c.get("userPayload")?.user_id);
		if (roleResponse) return roleResponse;
		return await next();
	}

	const roleResponse = await applyUserRole(c);
	if (roleResponse) return roleResponse;

	// address_login is how an address credential is obtained, so it cannot require one
	if (c.req.path.startsWith("/api/address_login")) {
		return await next();
	}

	try {
		return await addressJwtAuth(c, next);
	} catch (e) {
		console.warn(e);
		return c.text(i18n.getMessagesbyContext(c).InvalidAddressCredentialMsg, 401)
	}
});
// user_api auth: an account, plus the role that account was issued
app.use('/user_api/*', async (c, next) => {
	if (PUBLIC_USER_API_PATHS.some((path) => c.req.path.startsWith(path))) {
		return await next();
	}

	const identityResponse = await applyUserIdentity(c, { required: true });
	if (identityResponse) return identityResponse;

	const roleResponse = await applyUserRole(c, c.get("userPayload").user_id);
	if (roleResponse) return roleResponse;

	// binding an address proves ownership of that address as well as of the account
	if (c.req.path.startsWith('/user_api/bind_address') && c.req.method === 'POST') {
		return addressJwtAuth(c, next);
	}
	await next();
});
// admin auth: the access token must carry the admin role
app.use('/admin/*', async (c, next) => {
	const ipResponse = checkAdminApiIpWhitelist(c);
	if (ipResponse) return ipResponse;

	const roleResponse = await requireAdminRole(c);
	if (roleResponse) return roleResponse;

	await next();
});


app.route('/', commonApi)
app.route('/', openAuthApi)
app.route('/', mailsApi)
app.route('/', userApi)
app.route('/', adminApi)
app.route('/', apiSendMail)
app.route('/', telegramApi)
app.route('/', redeemApi)

const health_check = async (c: Context<HonoCustomType>) => {
	const lang = c.req.raw.headers.get("x-lang") || c.env.DEFAULT_LANG;
	const msgs = i18n.getMessages(lang);
	if (!c.env.DB) {
		return c.text(msgs.DBNotAvailableMsg, 400);
	}
	if (!c.env.JWT_SECRET) {
		return c.text(msgs.JWTSecretNotSetMsg, 400);
	}
	if (getDomains(c).length === 0) {
		return c.text(msgs.DomainsNotSetMsg, 400);
	}
	return c.text("OK");
}

app.get('/', health_check)
app.get('/health_check', health_check)
app.all('/*', async c => c.text("Not Found", 404))


export default {
	fetch: app.fetch,
	email: email,
	scheduled: scheduled,
}
