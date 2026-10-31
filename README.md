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
