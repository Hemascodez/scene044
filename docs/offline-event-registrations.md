# Host-collected event registrations

Offline tickets use the normal `event_registrations` seat and check-in records,
with `payment_source='host_direct'`. They have no Razorpay order, payment ID or
gateway fee, and do not create a user account. Unknown email/phone values are
stored as `NULL`, never invented. WhatsApp opt-in is false and no notification
is enqueued. Recording a paid ticket does not check its guest in.

The host and curator reports include these tickets in registration counts and
gross ticket revenue, but split host-collected funds from SCENE online funds.
Host-held money is not included in the amount held by SCENE for payout.

Use the normal migration command before recording offline guests. The script
accepts one private JSON batch on stdin and defaults to a rollback-only preview:

```json
{
  "eventId": 164,
  "expectedTitle": "Exact published event title",
  "expectedTotalPaise": 59800,
  "guests": [
    { "reference": "unique-offline-a", "name": "Reader A", "amountPaise": 29900 },
    { "reference": "unique-offline-b", "name": "Reader B", "amountPaise": 29900 }
  ]
}
```

```sh
node --import tsx scripts/record-offline-event-registrations.ts < private-batch.json
node --import tsx scripts/record-offline-event-registrations.ts --apply < private-batch.json
```

An optional `phone` accepts an Indian mobile number and is retained privately.
Only a subsequently authenticated account with that verified number can find
its ticket in My bookings; it cannot buy a second ticket accidentally. A guest
without a number stays on the organiser's guest list and may use their ticket
code at the door. No automatic message is sent by this bookkeeping action.

Reuse the exact same references on retries. The script rejects reference/detail
conflicts, potentially duplicate names/numbers, wrong event identity, ended or
cancelled events, and capacity conflicts (including active online seat holds).
The entire batch commits atomically. Its output contains totals, not contacts,
bearer tokens, credentials, or full ticket codes. Never commit real guest batches.

Validation: `npm run test:offline-event-registrations` uses an isolated in-memory
Postgres database with external requests blocked.
