-- Rows left behind by accounts deleted before deletion removed everything an account owned.
-- User ids are reused once the highest one is deleted, so the next account to take such an id
-- would inherit its role, passkeys and bound mailboxes. Safe to run more than once.
DELETE FROM user_roles WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM user_passkeys WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM users_address WHERE user_id NOT IN (SELECT id FROM users);
