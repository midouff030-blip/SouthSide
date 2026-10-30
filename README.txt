SOUTHSIDE S2 — WEBHOOKS STRICTLY SEPARATED

Render > Environment:
WEBHOOK_NEW_APPLICATIONS = URL of channel for NEW Whitelist / Gang / Staff submissions
WEBHOOK_WHITELIST = URL for Whitelist ACCEPTED / REJECTED results only
WEBHOOK_GANG = URL for Gang ACCEPTED / REJECTED results only
WEBHOOK_STAFF = URL for Staff ACCEPTED / REJECTED results only

IMPORTANT: NEW submissions NEVER fall back to WEBHOOK_WHITELIST, WEBHOOK_APPS or result webhooks.
If WEBHOOK_NEW_APPLICATIONS is absent, submission returns an error and no new application is sent to the wrong channel.

Deploy: upload server.js, package.json and public/index.html to your project, commit/push and redeploy Render.
Check Render logs for '[WEBHOOK ROUTING] New applications: configured (dedicated)'.
If still wrong, confirm Render is running the latest commit and WEBHOOK_NEW_APPLICATIONS URL points to a DIFFERENT Discord webhook/channel than WEBHOOK_WHITELIST.
Do not expose webhook URLs in frontend or screenshots.
