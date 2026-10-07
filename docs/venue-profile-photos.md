# Organiser profile photos

New accounts display initials, never the Figma sample portrait. Name, phone and email continue to come from the signed-in account.

Apply `db/migrations/2026-10-07-venue-profile-photos.sql` before deploying. Photos are private, limited to one per account and retrieved only through that account's authenticated session. Uploaded JPG/PNG/WebP images are resized in the browser to at most 512 pixels and encoded as JPEG. Stored images are limited to 512 KB. Responses are private and not cached. Upload and removal report success only after the server saves the change.

Old browser-only uploads are not automatically copied into accounts; users can upload them again. No real users' profile details or existing local images are overwritten by the migration.

Verification: `node --import tsx scripts/test-venue-profile-photo.ts` (in-memory fixture, no real database mutations).
