export const ErrorCode = {
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    AUTH_SITE_PASSWORD_INVALID: 'AUTH_SITE_PASSWORD_INVALID',
    AUTH_ADMIN_CREDENTIAL_INVALID: 'AUTH_ADMIN_CREDENTIAL_INVALID',
    AUTH_USER_ACCESS_TOKEN_EXPIRED: 'AUTH_USER_ACCESS_TOKEN_EXPIRED',
    AUTH_USER_TOKEN_INVALID: 'AUTH_USER_TOKEN_INVALID',

    isSiteAuthError: (response) => response.status === 401
        && response.data?.code === ErrorCode.AUTH_SITE_PASSWORD_INVALID,

    isUserAccessTokenError: (response) => response.status === 401
        && response.data?.code === ErrorCode.AUTH_USER_ACCESS_TOKEN_EXPIRED,

    isUserTokenError: (response) => response.status === 401
        && response.data?.code === ErrorCode.AUTH_USER_TOKEN_INVALID,
};
