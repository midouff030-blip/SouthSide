SouthSide S2 — Gang roster / edit fix

- Preserves existing Illegal Network / Shop global design; applies roster-only styling to #tab-illegal.
- Boss and Under Boss each show name, Discord avatar, role.
- Member roster uses Discord IDs and shows avatar and display name when available.
- Admin Panel > Gangs > Edit loads existing gang fields and Save Gang Changes uses PUT /api/gangs/:id.
- Discord GET /guilds/GUILD_ID/members/USER_ID confirms membership. When it fails, GET /users/USER_ID may still show public avatar, but the user is labeled Not verified in server. Do not treat public profile as proof of guild membership.
- Check Render logs [GANG ROSTER] for HTTP status and Discord error code. Confirm GUILD_ID, DISCORD_BOT_TOKEN, and bot is inside correct guild.
- The app stores gangs in local JSON; without Render persistent disk/database, changes may be lost on redeploy.
- Redeploy, refresh browser (Ctrl+F5), then test.
