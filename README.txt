SouthSide S2 Discord Admin Role Fix (Express/Render)

Replace server.js, package.json and public/index.html in the deployed Express project.
Set Render environment: GUILD_ID (Discord server ID), ADMIN_ROLE_ID (exact role ID), DISCORD_BOT_TOKEN (bot in that server with View Server permission), DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_CALLBACK_URL, SESSION_SECRET.
Deploy and login with Discord. Open browser console and Network -> /api/auth/check-admin to diagnose 401/403.
Role checks happen live on each request. Existing site UI and application routing are preserved.
NOTE: The separately supplied Vercel API files are a different backend architecture. This package is for the Express server.js deployment.
