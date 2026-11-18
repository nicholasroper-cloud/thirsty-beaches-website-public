# Thirsty Beaches website

- `site/` — the static site, deployed to Cloudflare Pages project `thirsty-beaches` (thirstybeaches.com). Deploy: `npx wrangler pages deploy site --project-name thirsty-beaches`
- `worker-tb-where/` — the tb-where Worker (live location, schedule, text signups, punch card, arcade scores). Deploy from that folder: `npx wrangler deploy`. Needs KV `TB_LOC` and secret `TB_SECRET`, both already set in Cloudflare. Quote alerts (optional secrets): `QUOTE_SMS_UTAH` / `QUOTE_SMS_FLORIDA` + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` for texts; `QUOTE_WEBHOOK` for ntfy/Discord/Slack/Zapier. See the header of `src/worker.js`.
  - No `QUOTE_WEBHOOK`? With the secret `RELAY_KEY` set, new-quote alerts and the 24/72 h reminders go to your phone through Salty Dog Tags' alert channels (Pushover / Twilio) via saltydogtags.com/api/relay. `QUOTE_WEBHOOK`, when set, always wins. See "Salty Dog Tags relay" below.
  - Quote follow-ups: an hourly cron (`triggers.crons` in `worker-tb-where/wrangler.jsonc`, deployed with the worker) pushes a "Still new after 24 h / 72 h" reminder through `QUOTE_WEBHOOK` for requests whose status on /trailer is still New (optional var `QUOTE_REMIND_HOURS`, default `24,72`).
  - Automatic "got it" email to the planner via Resend, off until you add the secret `RESEND_API_KEY` (verify the sending domain in Resend first). Optional vars: `EMAIL_FROM` (default `Thirsty Beaches <hello@thirstybeaches.com>`), `EMAIL_REPLY_TO` (default `hello@thirstybeaches.com`).
  - Punch cards can be saved to a phone number (no settings needed): the worker stores a peppered hash of the number plus its last 4 digits (`ph:` keys; the pepper is generated once into KV as `cfg:phone-pepper` — don't delete it or saved numbers stop matching). Recovery and merges need today's staff code. Phase 2 idea, not built: auto-punch from paid Clover orders that carry a customer phone, via the station worker.

- `tools/indexnow.mjs` — after a deploy to main is live, tell Bing and the other IndexNow engines about the sitemap URLs: `node tools/indexnow.mjs` (add `--dry-run` to preview, or pass paths like `/dirty-soda-washington-city` to send only those). The key file is `site/010245df2c5b7bb57c9b59abcb5f89ab.txt`; keep it deployed. Google ignores IndexNow, so also resubmit the sitemap in Search Console.
- `tools/build-st-george-towns.py` builds the Washington County town and neighborhood pages (Desert Color, Bloomington & Green Valley, Washington City, Santa Clara, Ivins, Hurricane & Sand Hollow, LaVerkin/Toquerville/Leeds); `tools/build-catering.py` builds the catering hubs and event pages, including the six St. George event pages (weddings, graduations & birthdays, HOA & neighborhood, church & school, tournaments, company parties). `/dirty-soda-st-george` is hand-edited and is the hub: link every new St. George page from its body. The old `/dirty-soda-ivins-santa-clara` 301s to Santa Clara in `site/_redirects`. Run `python3 tools/build-agent-files.py` after either. The St. George query map is `tools/seo/query-map-st-george.md`.

Source of the site before 2026-10-09 was ~/Downloads/thirsty-beaches-site_32 (direct zip uploads).

## Salty Dog Tags relay (one-click setup)

The station Worker (`thirsty-beaches-station`) and tb-where reuse what the Salty Dog Tags site already has, instead of new keys: its Clover Hosted Checkout key (same Clover account, MQKMTFBRXFP21) for "Pay on my phone" / "Order ahead", and its phone alerts for the station's daily report and site-down alerts and for quote alerts and reminders. They call `https://saltydogtags.com/api/relay` with a shared random key, `RELAY_KEY`.

Set it up once, in this order:

1. **Actions → "Set up relay key" → Run workflow** (`.github/workflows/setup-relay-key.yml`). It checks that all three exist, makes a random key (never shown), and stores it as `RELAY_KEY` on the Pages project `salty-dog-tags` and on the Workers `tb-where` and `thirsty-beaches-station`. Worker secrets apply at once (Cloudflare re-deploys the code that is already live, plus the secret; nothing from this repo is uploaded). The Pages secret applies with Salty Dog Tags' next deployment.
2. Merge the Salty Dog Tags relay branch to main. Its deploy puts the relay live with the key.
3. Deploy the station (Thirsty-Beaches- repo, merge to main) and tb-where (this repo, merge to main).

Running the workflow again replaces the key everywhere (rotation). Then run Salty Dog Tags' "Deploy site" workflow so the site picks up the new key too; until then relay calls are refused, phone pay falls back to "Pay at the window", and alerts retry on their next run. The workflow's last step tells you whether the relay already answers with the new key.

Own settings always win: `QUOTE_WEBHOOK` here, or `CLOVER_ECOMM_TOKEN` / any alert channel on the station, means the relay isn't used for that.


## Security and compliance settings (2026-11-15 review)

Pages project secrets (`npx wrangler pages secret put NAME --project-name thirsty-beaches`). None of these is committed.

| Name | Where | What it does |
|---|---|---|
| `KIOSK_KEY` | Pages secret here, the kiosk's config, and the tb-where Worker | 24+ random characters. The kiosk sends it as header `X-Kiosk-Key`. On `/api/mix` it selects its own rate-limit bucket (default 60 an hour, `KIOSK_MIX_LIMIT` to change) instead of the 5-per-visitor one, so the trailer's single IP is not throttled as one customer. Unset or short = the kiosk is treated like any visitor. |
| `IP_SALT` | Pages secret | Optional. Salts the hashed IP used for AI rate-limit counters. |
| `ALLOWED_ORIGINS` | Pages variable | Optional. Extra exact origins (comma separated, with `https://`) that may call the AI endpoints from a browser. The default list is thirstybeaches.com, www, and local `wrangler pages dev`; there is no `*.pages.dev` wildcard. |

What changed in `functions/api`:
- `/api/mix` and `/api/vibe` run every name, nickname, reading and why through the same denylist as the kiosk (`functions/api/_moderation.js`, a copy of the kiosk's `moderation.js` lists; keep the two in step, `tests/mix.test.mjs` pins it). A hit means the curated fallback copy, in kid mode and out of it.
- A JSON body of `null`, an array or a scalar is a 400 on every endpoint, not a 500.
- CORS: exact origins only.

`site/_headers` carries a Content-Security-Policy for the public pages (not `/trailer`, `/studio`, `/card`). It allows Google Fonts, Leaflet from unpkg, OpenStreetMap tiles, the tb-where API, the station order-ahead URL and today's specials from raw.githubusercontent.com. **Any new third-party script, style, font, image host or API must be added to that policy first**, or the browser will block it. The two inline scripts that used to be on the pages are now `site/sw-register.js` and `site/specials.js`.

`site/_routes.json` keeps `/assets/*` and the root static files off the Functions worker (the Markdown middleware runs for HTML, `.md` and `/api/*` only). If you add a new root static file, add it to the exclude list.

The Thirsty Maze weekly draw is OFF: `DRAW_ON` in `site/arcade.js` is `false` and the Worker only creates entries when `DRAW_ENABLED="true"`. See `worker-tb-where/README.md` ("Turning the draw on").

## Mixer photos

The mixer sends the photo to the AI provider and does not store it. The on-page notice says what the provider may keep (up to 30 days for safety checks) and that the mixer is for ages 13+. Keep the page notice, `site/privacy.html` and the kiosk sign in step.
