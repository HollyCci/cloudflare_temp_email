#!/usr/bin/env node
// Prints an admin `x-user-access-token` for the E2E worker signed with the given JWT secret.
// Usage: node --experimental-strip-types scripts/admin-token.mjs [jwt-secret]
import { adminAccessToken } from '../fixtures/access-token.ts';

process.stdout.write(adminAccessToken(process.argv[2] || undefined));
