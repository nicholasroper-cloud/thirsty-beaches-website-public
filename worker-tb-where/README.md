# tb-where (Cloudflare Worker)

Location pin, schedule, alert signups, event quotes, the Thirsty Maze scores and draw, the punch card and the kiosk heartbeat.
Route list and behavior: the comment at the top of `src/worker.js`. Tests: `node test/<name>.test.mjs` (no dependencies).

## Secrets and variables (set with `wrangler secret put NAME` / dashboard variables; never commit values)

| Name | Needed for | Notes |
|---|---|---|
| `TB_SECRET` | all staff routes | Long random string. The staff day code (`UPSIZE-XXXXXXXX`) is derived from it. |
| `PLAY_SECRET` | Maze prize codes, leaderboard, draw | 32+ random characters, NOT the same as `TB_SECRET`. Signs the play tokens (`GET /scores/token`). Unset = no tokens: the game still plays, but no score is recorded and no code or ticket is issued. |
| `KIOSK_KEY` | burning a Maze code (`POST /redeem` with `redeem:true`) | 24+ random characters, sent by the kiosk as header `X-Kiosk-Key`. Also used by the website's `/api/mix` (same value on the Pages project). Unset = redeeming is off (503), never open. The kiosk repo must send the header on its `/redeem` calls. |
| `IP_SALT` | hashed IP counters | Optional; falls back to `TB_SECRET` as the salt. |
| `PRIZE_DAILY_CAP` | Maze prize codes | Optional, default 100 codes a day for the whole site; one per network per day. |
| `DRAW_ENABLED` | the weekly draw | `"true"` to accept draw entries. Leave unset until the official rules are published (see below). |
| `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` | the signup confirmation text and STOP/HELP/YES replies | Without them nothing is texted: signups stay pending and staff confirm them (`POST /subs/confirm`). `TWILIO_INBOUND_URL` overrides the URL used to check Twilio's request signature if the Worker sits behind a custom domain. |
| `RESEND_API_KEY` (+ `EMAIL_FROM`) | the signup confirmation email | Without it, email signups stay pending for staff. |

## Before deploy (prerequisites)

1. **Cloudflare rate-limit rules** (dashboard > Security > WAF > Rate limiting) on `tb-where.nicholasroper.workers.dev`: `/subscribe` (for example 10 requests per minute per IP), `/scores` and `/scores/token` (for example 20 per minute per IP). The Worker's own per-IP limits live in each isolate's memory and are a speed bump, not a wall; a distributed flood is bounded only by the KV counters, and a signup costs 4-5 KV writes.
2. **KV plan.** The free plan allows 1,000 writes a day for the whole `TB_LOC` namespace (live pin, schedule, scores, cards, signups). `SIGNUPS_PER_DAY` is 100 for that reason (about 500 writes). Raise it in `src/worker.js` only on a paid plan.
3. **Kiosk first.** Maze codes can only be burned with `X-Kiosk-Key`. Ship the kiosk build that sends it (and treats a failed burn as a failed order) and set `KIOSK_KEY` in the Worker, Pages and the kiosk config, THEN deploy this Worker. Deploying the Worker first leaves codes reusable.
4. **Owner app.** It must call `POST /card/redeem` and send the 8-character day code before loyalty redeem works from it.

## Alert signups (double opt-in)

`POST /subscribe` creates a **pending** record (`pend:<contact>`) with `source` (`web` or `kiosk`), `consentVersion` (SHA-256 of the exact consent text shown) and `ts`. The person is added to the list (`csub:<contact>`, the only list `/broadcast` uses) only when they:
- reply YES to the confirmation text (Twilio inbound webhook: set the number's "A message comes in" URL to `https://<worker>/sms/inbound`), or
- tap the emailed link (`/confirm?c=...`), or
- are confirmed by staff: `POST /subs/confirm {contact}` (Bearer `TB_SECRET`). `GET /subs` shows confirmed, pending and legacy.

STOP, END, CANCEL, UNSUBSCRIBE, QUIT and plain-language opt-outs remove the number at once; HELP answers. The self-serve page is `/unsubscribe` (`POST /unsubscribe`). Limits: 8 signups an hour per IP, 3 confirmation texts per number, 100 signups a day. `GET /subscribe/status` says whether a confirmation text or email can be sent; the website hides its signup form until it says yes. A client that does not send `source` and the hash of the wording it showed (`consentVersion`) is stored as `source: unknown`, `consentVersion: null`; the old kiosk body is therefore never recorded as the website's text. A number that is already confirmed gets the same reply as a new signup.
Signups from before this change are in the old `sub:` list and are NOT texted. Before the first broadcast, run `POST /subs/reconfirm` (Bearer) in batches to send them the confirmation text; only those who reply YES are on the list.
The consent wording is kept per version in `consent/` and pinned by `test/consent.test.mjs`.

## Staff day code and the punch card

The day code is `UPSIZE-` plus 8 characters (it was 4 digits), computed from the trailer's Denver calendar date (not UTC). Wrong guesses are counted per IP in KV (8 per 15 minutes) on top of the in-memory brake. Staff type the 8 characters (the `UPSIZE-` prefix is optional). The owner app (a separate repo) still shows or expects the old 4 digits and must be updated.
Loyalty "use a free drink" moved from `POST /redeem` to **`POST /card/redeem`** (`{id, staff}`). `/redeem` is only for Maze prize codes now.

## Turning the draw on

The weekly draw is paused. To turn it on:
1. Fill the three `[NICK TO FILL IN ...]` placeholders in `site/maze-rules.html` (sponsor name and address, prize and approximate retail value, where claims are honored), remove its `noindex` line, and have counsel look at it.
2. Set `DRAW_ENABLED` to `true` here and `DRAW_ON = true` in `site/arcade.js`, then deploy both.
3. Winners: `GET /draw` (staff) lists tickets and the winner; `GET /draw/last` (public) is what the rules page shows; `POST /draw/claim {ticket}` (staff, at the window) marks a ticket claimed once.
Entries collect no personal data: one ticket per network per week (hashed IP in the key), a 500+ score, weeks run Monday to Sunday Mountain Time.
