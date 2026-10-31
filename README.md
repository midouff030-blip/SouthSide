# SouthSide S2 — Multi Admin + Whitelist update

## Render environment
Add `ADMIN_DISCORD_IDS` containing all allowed Discord User IDs, separated by commas. Example (FAKE IDs):
`ADMIN_DISCORD_IDS=111111111111111111,222222222222222222,333333333333333333`

Each admin must log in using Discord OAuth. The server compares their authenticated Discord ID with the allowlist. Changing the list requires saving environment variables and redeploying/restarting the server. Role-based admin checks still work when Discord guild/bot settings are correct; password-based admin login remains unchanged.

## Deployment
Upload `server.js`, `package.json` to repository root and `public/index.html` into `public/`. Do not nest an extra project folder. Set the environment variable on Render and deploy latest commit. Log out and log in to Discord again. Never publish secrets or real user IDs in your public repository.

## Whitelist
Added required IRL Age and Character Backstory questions. Existing application submission and webhook flow is unchanged.

## Important
No live deployment or end-to-end Discord test was performed. Existing admin password login remains enabled; use a strong password. If the bot lookup logs 404, the ID allowlist works independently of that lookup.


## Discord login / application session fix
- Session cookie uses SameSite=Lax (appropriate for OAuth top-level redirects) and secure HTTPS in production.
- OAuth callback waits for session save before redirect.
- /api/auth/me is no-store; frontend includes same-origin credentials.
- Set NODE_ENV=production on Render and a stable SESSION_SECRET.
- Important: Express MemoryStore loses sessions on service restarts/redeploys. Log in again after deployment. For production persistence across restarts/multiple instances, use Redis/session store.
- Confirm the deployed website and API share the same domain.

## Accepted Discord role fix
When admin accepts Whitelist, Gang or Staff applications, the backend now checks the actual Discord HTTP response, logs errors, and returns `roleAssigned` and `roleError` in the API response. Re-clicking Accepted retries role assignment without duplicating the decision webhook.

Render variables: `DISCORD_BOT_TOKEN`, `GUILD_ID`, `ROLE_ACCEPTED_ID` (common fallback) or `ROLE_ACCEPTED_WHITELIST`, `ROLE_ACCEPTED_GANG`, `ROLE_ACCEPTED_STAFF` (category-specific). `ROLE_ACCEPTED_ID` from your screenshot is supported.

Discord bot must be in the guild, have Manage Roles permission, and its highest role must be ABOVE the accepted role. Applicant must be a member of that guild. Discord 403 means missing permission/role hierarchy; 404 means unknown member/guild/role or incorrect IDs; 401 means invalid bot token. Check Render logs for `[ACCEPT ROLE]`.

Existing previously accepted applications: click Accepted again to retry the role assignment. No live Discord test was performed.
