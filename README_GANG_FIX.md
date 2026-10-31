# Gang Admin Fix
- Illegal Network and Shop visual CSS were not modified.
- Boss Name / Discord ID, Under Boss Name / Discord ID, and Member Discord IDs are separate fields.
- Discord lookup errors no longer hide the entered member; a placeholder appears instead of a fake profile picture.
- Render logs show `[GANG ROSTER]` with HTTP status and Discord error code. 10007 = Unknown Member; 10004 = Unknown Guild. Check GUILD_ID and bot membership, then the exact member ID.
- A real Discord avatar is displayed only after successful guild member verification. Discord default avatars may show as placeholders.
- Deploy the files and check Render logs; live Discord verification was not performed.
