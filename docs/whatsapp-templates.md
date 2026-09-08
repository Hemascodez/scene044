# WhatsApp message templates — for Meta approval

Submit these directly in WhatsApp Manager. Approval is **per template, not per
message**: once a template is approved, the Cloud API can send it. Keep the
production kill switch off until approval and a test delivery both succeed.

## What actually needs a template

| Situation | Template needed? |
|---|---|
| Visitor messages us from the wa.me link | No |
| Our reply, **within 24h** of their message | No — free-form is allowed in that window |
| Anything we send **after** the 24h window closes | **Yes** |

So the welcome reply needs no template at all. Everything below is for
business-initiated sends through Meta's Cloud API.

## Meta formatting rules these already respect

- Variables are `{{1}}`, `{{2}}`, numbered from 1 with no gaps. Numbering is
  per component, so the URL button has its own `{{1}}` suffix.
- A body may not **start or end** with a variable, and two variables may not
  sit **adjacent** to each other. Both are automatic rejections.
- Body ≤ 1024 characters, footer ≤ 60.
- The weekly digest uses one website CTA. Text replies containing `STOP` or
  `Stop updates` are still handled immediately by the webhook.
- Sample values are required at submission. The ones given are realistic
  because Meta rejects placeholder junk like "test" or "xxx".

---

## 1. `scene044_weekly_digest` — MARKETING

The main one. Weekly roundup of what's on.

This is Marketing even though the user opted into a subscription: it recommends
events the user has not booked or registered for. Utility is for a specific,
requested interaction or an active transaction (for example, a registration
confirmation or a change to an event the user already booked).

**Header** (text): `This week in Chennai tech`

**Body**

Copy only the text inside this block. Do **not** paste the opening/closing
backticks. For the `{{2}}` sample, enter real line breaks rather than the two
characters `\\n`.

```
Hi {{1}}, here are your Chennai tech picks for this week:

{{2}}

See more {{3}} events using the button below.

You subscribed to SCENE/044 updates. Reply STOP to unsubscribe.
```

**Footer**: `SCENE/044 — Chennai tech events`

**Buttons**
- URL button — `Visit website` → `https://scene044.in/category/{{1}}`

**Body sample values**
1. `Hema`
2. Enter these as three actual lines:

   ```text
   • Global AI Conference — Sat, 27 Sep, 9:30 AM — Taramani
   • eChai Demo Day — Fri, 26 Sep, 6:00 PM — Guindy
   • Dev Days Chennai — Fri, 10 Oct, 10:00 AM — OMR
   ```

3. `AI & Machine Learning`

**URL button sample value**: `ai`

The sender supplies the URL suffix dynamically. A subscriber with one interest
opens that field page. For multiple interests, the button opens the category of
the first-ranked event in their digest. Product and Design both map to
`/category/product-design`.

---

## 2. `scene044_event_reminder` — MARKETING

Fires the day before an event the subscriber's chosen fields match.

> Category note: this is **MARKETING**, not UTILITY, even though "reminder"
> sounds transactional. UTILITY covers messages about a transaction the user
> already entered into — an order, a booking, an account. We don't handle
> registration, so there is no transaction. Submitting it as UTILITY to get the
> cheaper rate is a miscategorisation and Meta reclassifies or rejects it.

**Body**

```
Reminder: {{1}} is tomorrow.

When: {{2}}
Where: {{3}}

Details and registration: {{4}}
```

**Footer**: `Reply STOP to unsubscribe`

**Buttons**
- URL button — `Visit app` → `https://scene044.in/`

**Sample values**
1. `Global AI Conference Chennai`
2. `Sat 27 Sep, 9:30 AM`
3. `IIT Madras Research Park, Taramani`
4. `https://scene044.in/`

---

## 3. `scene044_optin_confirm` — UTILITY

Only needed if a confirmation is ever sent **outside** the 24-hour window.
Inside it, reply free-form and skip this entirely.

**Body**

```
You're subscribed to SCENE/044 — Chennai tech events.

You'll get {{1}} with what's on. Reply STOP any time to opt out.
```

**Sample value**
1. `a weekly roundup`

---

## Before submitting

- The display name on the WhatsApp Business account must match the brand, or
  templates referencing "SCENE/044" can be rejected for impersonation.
- Handle inbound `Stop updates` and `STOP` text — set
  `subscribers.status = 'unsubscribed'`. Ignoring an opt-out damages the
  number's quality rating, which throttles all sending.
- Keep the wa.me pre-filled text and the template's "you subscribed by
  messaging us" line consistent. That pairing is the consent record if Meta
  ever queries it.

## Approval and rollout checklist

1. Submit `scene044_weekly_digest` as **Marketing**, language **English (US)**,
   with the exact header, body, footer, and buttons above.
2. Configure the permanent token, Phone Number ID, and a currently supported
   `WHATSAPP_GRAPH_API_VERSION` on both Railway web and digest services.
3. Leave `WHATSAPP_DIGEST_ENABLED=false` and run
   `npm run whatsapp-digest -- --dry-run`.
4. Set `WHATSAPP_TEST_RECIPIENT` to an opted-in, active internal subscriber, run
   `npm run whatsapp-digest -- --test`, and verify the status webhook records
   `delivered`.
5. Set `WHATSAPP_DIGEST_ENABLED=true` only after the test succeeds. The
   dedicated Railway schedule is `30 12 * * 3` UTC (Wednesday 18:00 IST).
