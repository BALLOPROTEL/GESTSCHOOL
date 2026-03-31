# Notifications Extraction Blueprint

## Canonical Event

`notification.requested` is the only event that the future Notifications service should consume directly.

Payload:
- `schemaVersion`
- `requestId`
- `requestedAt`
- `kind`
- `channel`
- `recipient`
- `content`
- `schedule`
- `source`

Metadata:
- `schemaVersion`
- `eventId`
- `tenantId`
- `occurredAt`
- `correlationId`
- `idempotencyKey`
- `producer`
- `causationId`

## Data Ownership Target

The extracted Notifications service should own:
- `notifications`
- `notification_delivery_attempts`
- `notification_provider_callbacks`
- its own `outbox_events` or broker offsets/inbox table

The service should keep `request_payload` as the canonical replay envelope `{ payload, metadata }`.

## Dependencies To Cut Before Extraction

- Stop exposing Notifications through `SchoolLifeController`; move `/notifications` and `/notifications/delivery-events`.
- Remove notification dispatch logic still duplicated in `school-life.service.ts`.
- Replace direct producer knowledge in `school-life` and `finance` with the typed bus only.
- Introduce a relay from DB outbox to broker or a standalone outbox-forwarder process.

## Shadow And Cutover Sequence

1. Keep the monolith as producer of `notification.requested`.
2. Start the extracted service in shadow mode and consume the same requests without dispatching externally.
3. Compare materialized notifications, retries and callback handling against the monolith tables.
4. Move provider webhooks to the extracted service.
5. Switch external dispatch to the extracted worker.
6. Move read/write `/notifications` endpoints behind the gateway to the new service.
7. Freeze monolith writes, validate lag at zero, then retire in-process dispatch.

## Rollback

- Keep the monolith producer active during cutover.
- If dispatch or callbacks degrade, route `/notifications` and provider webhooks back to the monolith and stop the extracted worker.
- Replay unprocessed `notification.requested` events from outbox or broker after rollback.
