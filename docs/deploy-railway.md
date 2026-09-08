# Deploying SCENE/044 — Railway + Supabase

Four Railway services from one repo, plus a Supabase database. `next start`
reads `PORT` from the environment and binds `0.0.0.0`, so Railway needs no
extra port configuration.

## Why this shape

The app is one Next.js server — `app/page.tsx` queries Postgres in-process,
so there is no frontend/backend to split across hosts. The pipeline is the
only part that genuinely wants its own runtime, because a full discovery sweep
takes ~98 seconds and extraction waits out per-domain politeness windows on top.
As a scheduled container that has no timeout to exceed. As a serverless
function it would be killed (Netlify free is 10s).

---

## 1. Supabase

1. New project → copy the **pooled** connection string (port `6543`, the one
   labelled *Transaction pooler*). Not the direct `5432` string: a container
   that redeploys reconnects, and direct connections exhaust the limit.
2. Apply the schema and seeds:

```bash
DATABASE_URL="<pooled-url>" npm run migrate
```

```bash
DATABASE_URL="<pooled-url>" npx tsx scripts/seed-sources.ts && DATABASE_URL="<pooled-url>" npx tsx scripts/seed-queries.ts
```

`db/schema.sql` enables RLS on `subscribers` and `subscriber_sends` with no
policies — deny-all. Note that this app connects with `pg` as the owner, which
**bypasses RLS**; that protection is against the anon key / PostgREST, not
against our own code.

**Watch the 500 MB free limit.** Posters are `BYTEA` in `poster_uploads` at a
few hundred KB each — roughly 1,500 posters fills it.

## 2. Web service

- Connect the GitHub repo. `railway.json` sets build and start.
- Add every variable from `.env.example`.

## 3. Cron service

Add a **second service from the same repo**, then in its settings:

- **Start command**: `npm run pipeline`
- **Cron schedule**: `30 3,13 * * 1-3` — 09:00 and 19:00 IST, Monday to Wednesday

Railway cron is UTC, so 09:00 and 19:00 IST are 03:30 and 13:30 UTC — cron's
comma syntax runs both from a single schedule line, no second service needed.
Six runs a week: each one loops extraction until the queue drains or a
20-minute budget is spent.

`tsx` is a runtime **dependency**, not a devDependency, specifically for this
service: Nixpacks builds with `NODE_ENV=production`, which skips devDependencies,
and the cron job would fail with `tsx: not found` at 01:30 with nobody watching.

Railway requires a cron process to exit when finished — `scripts/run-pipeline.ts`
closes the pool and exits, so this is satisfied. Minimum interval is 5 minutes.

The run does discovery → extraction (looping until the queue drains or a
20-minute budget is spent) → verification.

Add a **third service** for weekly housekeeping:

- **Start command**: `npm run pipeline -- --cleanup-only`
- **Cron schedule**: `0 2 * * 4` (07:30 IST Thursday)

Thursday, so housekeeping lands after the week's three discovery runs.

That expires events whose date has passed, clears queue items too old to still
be upcoming, and deletes orphaned poster bytes. Nothing else is deleted —
expired rows stay for auditing and for a "what you missed" surface. Tune with `--max-minutes`,
`--limit`, `--discover-only`, `--extract-only`, `--verify-only`.

## 4. Wednesday WhatsApp digest service

Add a **fourth service from the same repo**:

- **Start command**: `npm run whatsapp-digest`
- **Cron schedule**: `30 12 * * 3` — Wednesday 18:00 IST (Railway cron is UTC)
- **Required variables**: `DATABASE_URL`, `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_API_VERSION`,
  `WHATSAPP_WEEKLY_TEMPLATE_NAME=scene044_weekly_digest`, and
  `WHATSAPP_WEEKLY_TEMPLATE_LANGUAGE=en_US`
- **Kill switch**: `WHATSAPP_DIGEST_ENABLED=false` during setup

The digest service reads the same database as the web service. Its campaign
ledger prevents a second invocation in the same IST week from sending to the
same subscriber again. A request that may have reached Meta but returned no
definitive response is recorded as `unknown` and is not retried.

Roll out in this order:

```bash
npm run whatsapp-digest -- --dry-run
```

Inspect subscriber/event counts and the rendered blocks. Then set
`WHATSAPP_TEST_RECIPIENT` to an opted-in internal number and run:

```bash
npm run whatsapp-digest -- --test
```

The test number must first opt in through WhatsApp so it has an active
subscriber row. Test mode sends only to that number and writes an isolated
`whatsapp-weekly-test:*` ledger row, allowing the web-service webhook to change
it from `accepted` to `delivered` without suppressing those events from the
production digest. Only then set `WHATSAPP_DIGEST_ENABLED=true` on the digest
service and enable its Wednesday cron.

Verify the latest test callback in Postgres:

```sql
SELECT campaign_key, status, accepted_at, delivered_at, error
FROM subscriber_sends
WHERE campaign_key LIKE 'whatsapp-weekly-test:%'
ORDER BY sent_at DESC
LIMIT 1;
```

### NEXT_PUBLIC_ variables must be set at BUILD time

`NEXT_PUBLIC_WHATSAPP_NUMBER` is inlined into the client bundle when `next build` runs. Setting them only as runtime
variables produces a hydration mismatch: the server renders the alerts banner
(it reads `process.env` live) while the client bundle has `undefined` baked in
and renders nothing. Railway exposes service variables to the build, so simply
adding them to the service is enough — just don't add them *after* a deploy and
expect the existing build to pick them up. Rebuild.

Leave it empty and the alerts banner does not render at all.

### Automatic WhatsApp subscriber sync to Google Sheets

The verified WhatsApp webhook automatically upserts each sender into one fixed
spreadsheet. Replayed webhook deliveries update the row matching the phone
number instead of adding duplicates.

1. Enable the Google Sheets API in the Google Cloud project.
2. Create a service account and a JSON key for it.
3. Create a spreadsheet with a blank `Sheet1` tab (or set
   `GOOGLE_SHEETS_TAB_NAME` to another blank tab).
4. Share that spreadsheet with the service account's email as an **Editor**.
5. Set `GOOGLE_SHEETS_SPREADSHEET_ID`,
   `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_SHEETS_PRIVATE_KEY` on
   the Railway web service. Copy `private_key` from the JSON key; Railway can
   store it on one line with its `\\n` sequences intact.

The sheet columns are Phone Number, Name, Role, Categories, Message, Consent
Note, Status, and Subscribed At. Keep the configured tab blank on first use so
the app can add those headers safely. Subscriber messages are personal data;
restrict spreadsheet sharing to people who need access.

## 5. Secrets

Generate fresh values for production — do not reuse the local ones:

```bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

`CRON_SECRET` is 13 characters locally and `CURATOR_PASSWORD` is `scene`. Both
were fine on localhost. Neither is fine once `/api/cron/*` and `/admin/*` are
reachable from the internet.

## 6. Domain

Add `scene044.in` in Railway's service settings and point the CNAME at the
Railway target. Cloudflare is still worth using as the registrar and DNS host.

---

## Post-deploy checks

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://scene044.in/api/admin/curator/queue
```

Expect `401`. Then `curl https://scene044.in/api/cron/extract` — also `401`
without the bearer token. Load the homepage and confirm events render.

Trigger the cron service manually once from Railway's dashboard and confirm the
logs show `pipeline finished in …s` and the process exits.

For the digest service, leave `WHATSAPP_DIGEST_ENABLED=false` until Meta has
approved the exact English (US) template in `docs/whatsapp-templates.md`. Both
the web and digest services need the same permanent Meta token, phone number
ID, and supported Graph API version; the web service needs them for the welcome
and STOP confirmations, while the digest service uses them for templates.
