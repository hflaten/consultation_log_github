# ConsultAssist

Static GP consultation-sheet website intended for deployment to Vercel.

## Source Repository

- GitHub: https://github.com/hflaten/consultation_log_github

## Hosting Target

- Vercel
- Project: `custombase/consultassist`
- Production URL: https://consultassist.vercel.app
- Deployments: managed by Vercel Git integration from `main`.
- Status: deployed to Vercel and connected to GitHub.
- Previous here.now preview: https://spruce-ledger-n4kv.here.now/

## Vercel Environment Variables To Add Manually

Add these variables in Vercel Project Settings before using AI generation:

- `OPENAI_API_KEY`
  - Used by `api/ai/sheet.js` to generate specialized sheets.
- `SUPABASE_URL`
  - Value: `https://tnklkqcmzxwnvhnbgsay.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`
  - Used server-side only by `api/ai/sheet.js` to read/write the private template cache bucket.

The browser only calls `/api/ai/sheet`. It never receives OpenAI or Supabase service-role credentials.

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
- Prefer a Vercel Function or Supabase Edge Function for model calls, writes, signed URLs, and private storage operations.
- Supabase Storage buckets are private by default; public buckets make files accessible to anyone with the URL.
- Storage uploads require RLS policies. Upsert requires insert, select, and update permissions.
- Supabase-backed shared template caching is wired through the Vercel Function, not anonymous storage policies.

## Current MVP

- `index.html`: GP-facing workflow.
- `styles.css`: responsive interface and print/PDF layout.
- `app.js`: local sheet generation stub, browser cache, answer capture, severity support summary, copy action, and print-to-PDF export.
- `SOURCE_POLICY.md`: source hierarchy and licensed-content policy for Norwegian GP content.

The current MVP first checks browser localStorage, then calls the Vercel Function. The function checks Supabase private storage for a reusable sheet template, generates with OpenAI on cache miss, and writes the generated template back to Supabase.
