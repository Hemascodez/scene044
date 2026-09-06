# WhatsApp message templates — for Meta approval

Submit these in the WhatsApp Manager (or AiSensy's template screen, which
forwards to Meta). Approval is **per template, not per message**: once a
template is approved, sends are instant. Approval is usually minutes, but
manual review can take 24–48h — which is why these go in before the sending
code exists, not after.

## What actually needs a template

| Situation | Template needed? |
|---|---|
| Visitor messages us from the wa.me link | No |
| Our reply, **within 24h** of their message | No — free-form is allowed in that window |
| Anything we send **after** the 24h window closes | **Yes** |

So the welcome reply needs no template at all. Everything below is for
business-initiated sends, which is where the ~₹0.86 India marketing rate
applies, per message, regardless of what AiSensy's own plan costs.

## Meta formatting rules these already respect

- Variables are `{{1}}`, `{{2}}`, numbered from 1 with no gaps.
- A body may not **start or end** with a variable, and two variables may not
  sit **adjacent** to each other. Both are automatic rejections.
- Body ≤ 1024 characters, footer ≤ 60.
- Marketing templates should carry an opt-out button — Meta weighs this in
  quality scoring, and a low quality rating gets templates paused.
- Sample values are required at submission. The ones given are realistic
  because Meta rejects placeholder junk like "test" or "xxx".

---

## 1. `scene044_weekly_digest` — MARKETING

The main one. Weekly roundup of what's on.

**Header** (text): `This week in Chennai tech`

**Body**

```
Hi {{1}}, here's what's happening in Chennai this week.

{{2}}

Full list with venues, timings and links: {{3}}

You're getting this because you messaged SCENE/044 to subscribe.
```

**Footer**: `SCENE/044 — Chennai tech events`

**Buttons**
- URL button — `View all events` → `https://scene044.in/`
- Quick reply — `Stop updates`

**Sample values**
1. `Hema`
2. `Global AI Conference Chennai — Sat 27 Sep, Taramani\neChai Startup Demo Day — Fri 26 Sep, Guindy\nDev Days Chennai — Fri 10 Oct, OMR`
3. `https://scene044.in/`

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
- Quick reply — `Stop updates`

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
- Handle the `Stop updates` quick reply and the word `STOP` on the inbound
  webhook — set `subscribers.status = 'unsubscribed'`. Ignoring an opt-out
  damages the number's quality rating, which throttles all sending.
- Keep the wa.me pre-filled text and the template's "you subscribed by
  messaging us" line consistent. That pairing is the consent record if Meta
  ever queries it.
