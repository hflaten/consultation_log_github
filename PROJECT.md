# ConsultAssist

Static GP consultation-sheet website intended for deployment to here.now.

## Source Repository

- GitHub: https://github.com/hflaten/consultation_log_github

## Hosting Target

- here.now
- Status: local MVP exists, but publishing is blocked in this session by network/usage-limit restrictions.

## Supabase Target

- Project name: `consult assist`
- Project ref: `tnklkqcmzxwnvhnbgsay`
- URL: https://tnklkqcmzxwnvhnbgsay.supabase.co
- Region: `ap-southeast-1`
- Status checked on 2026-05-01: `ACTIVE_HEALTHY`
- Storage buckets created on 2026-05-01.

## Storage Plan

Use Supabase for storage related to reusable sheet templates and any optional report export storage.

Planned buckets:

- `consultassist-sheet-templates`
  - Purpose: reusable generated consultation sheet templates.
  - Privacy: can be private or service-only; do not store patient-identifiable completed consultations here.
  - Status: created as a private bucket with `application/json` allowed.
  - Cache key should include complaint/topic, age band, sex when clinically relevant, language, care setting, prompt/schema version, and template version.

- `consultassist-report-exports`
  - Purpose: optional PDF/report export storage if the GP needs saved files beyond local browser download.
  - Privacy: private bucket only.
  - Status: created as a private bucket with PDF, plain text, and JSON allowed.
  - Access should use signed URLs or authenticated access from a trusted server/Edge Function.

Security notes:

- Never expose Supabase service role keys in the static frontend.
- Prefer a here.now proxy route or Supabase Edge Function for model calls, writes, signed URLs, and private storage operations.
- Supabase Storage buckets are private by default; public buckets make files accessible to anyone with the URL.
- Storage uploads require RLS policies. Upsert requires insert, select, and update permissions.

## Current MVP

- `index.html`: GP-facing workflow.
- `styles.css`: responsive interface and print/PDF layout.
- `app.js`: local sheet generation stub, browser cache, answer capture, severity support summary, copy action, and print-to-PDF export.

The current MVP uses browser localStorage for reusable template caching as a no-backend placeholder. Supabase should replace or supplement that cache when the server-side/proxy layer is added.
