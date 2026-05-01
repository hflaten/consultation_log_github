-- ConsultAssist Supabase storage plan
-- Target project: tnklkqcmzxwnvhnbgsay
-- URL: https://tnklkqcmzxwnvhnbgsay.supabase.co
--
-- Review before applying. Bucket creation can also be done through the
-- Supabase Dashboard or Storage API. Keep service role keys server-side only.

-- Reusable, non-patient-specific sheet templates.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultassist-sheet-templates',
  'consultassist-sheet-templates',
  false,
  1048576,
  array['application/json']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Optional private storage for generated report/PDF exports.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultassist-report-exports',
  'consultassist-report-exports',
  false,
  5242880,
  array['application/pdf', 'text/plain', 'application/json']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies should be added once the final access model is chosen.
-- For a static site, writes and signed URLs should go through a trusted
-- server-side layer such as a Vercel Function or Supabase Edge Function.
--
-- Do not add broad anon write/update policies for report exports.
-- If you choose to make the reusable template cache publicly readable/writable
-- because templates contain no patient-specific information, add only
-- bucket-scoped policies for `consultassist-sheet-templates` and document
-- the abuse/cost tradeoff first.
