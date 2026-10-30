SouthSide S2 - All New Applications to ONE Discord webhook

Render Environment: WEBHOOK_NEW_APPLICATIONS = https://discord.com/api/webhooks/...
All new Whitelist, Gang, Staff applications go to that webhook with their respective titles and answers.
Accepted/Rejected messages still use WEBHOOK_WHITELIST, WEBHOOK_GANG, WEBHOOK_STAFF.

Deploy server.js and package.json in project root; deploy index.html in public/index.html.
Never put Discord webhook URLs in HTML. Redeploy after setting environment variables.
