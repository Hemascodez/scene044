# Deploying SCENE/044 — Railway + Supabase

Two Railway services from one repo, plus a Supabase database. `next start`
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
- **Cron schedule**: `30 1 * * *` (07:00 IST)

Railway requires a cron process to exit when finished — `scripts/run-pipeline.ts`
closes the pool and exits, so this is satisfied. Minimum interval is 5 minutes.

The run does discovery → extraction (looping until the queue drains or a
20-minute budget is spent) → verification. Tune with `--max-minutes`,
`--limit`, `--discover-only`, `--extract-only`, `--verify-only`.

## 4. Secrets

Generate fresh values for production — do not reuse the local ones:

```bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

`CRON_SECRET` is 13 characters locally and `CURATOR_PASSWORD` is `scene`. Both
were fine on localhost. Neither is fine once `/api/cron/*` and `/admin/*` are
reachable from the internet.

## 5. Domain

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
