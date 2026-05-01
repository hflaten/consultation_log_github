# ConsultAssist source and ingestion policy

This policy defines which source material ConsultAssist may use for reusable
consultation-sheet templates, including NEL, Helsebiblioteket, and
Helsedirektoratet-related workflows.

## Allowed source categories

ConsultAssist templates must declare one of these source categories:

1. `public_official_guidance`
   - Public official guidance from sources such as Helsedirektoratet or other
     official public health authorities.
   - Templates must store attribution, source URL or identifier, source
     publication/update date when available, retrieval date, and the internal
     template version.
   - Generated text must summarize and operationalize the guidance for the GP
     workflow; it must not imply exact guideline wording unless the source has
     been checked and cited.
2. `licensed_customer_provided_content`
   - Content provided by a customer who has documented the right to use it in
     ConsultAssist, including licensed NEL-derived templates when the customer
     has permission.
   - The license scope, customer owner, intake date, source version/date, and
     permitted use must be recorded before ingestion.
3. `clinician_authored_local_template`
   - Templates authored locally by clinicians for their own practice or customer
     organization.
   - The authoring clinician or owning organization, template version/date, and
     review state must be recorded.
4. `ai_generated_clinical_method`
   - AI-generated support based on general clinical consultation method,
     without copying proprietary source text.
   - These templates may approximate workflow patterns, question structures,
     red-flag checks, and clinical reasoning scaffolds, but must be labeled as
     generated support rather than as exact guideline or NEL content.

## Disallowed behavior

ConsultAssist must not:

- Scrape, bulk-download, copy, or reproduce NEL content without explicit license
  permission from the customer or rightsholder.
- Represent AI-generated content as exact NEL content, exact guideline text, or
  source-verified recommendations unless the source has been verified and the
  template carries source metadata.
- Strip attribution, version, date, license, or review metadata from
  source-backed templates.
- Cache patient-identifiable completed consultations in reusable template
  storage.

## Required source metadata

Every reusable template should carry `sourceMetadata` with these fields:

- `category`: one of the allowed source categories above.
- `name`: source name or internal source identifier.
- `sourceVersion`: source version, model version, publication version, or local
  template version label.
- `sourceDate`: source publication/update date when available.
- `retrievedAt`: date the source was retrieved or ingested when applicable.
- `templateVersion`: ConsultAssist template version.
- `sourcePolicyVersion`: policy version used to evaluate the template.
- `generatedAt`: generation or normalization timestamp for generated templates.

Templates must also carry review metadata with:

- `status`: `draft`, `clinician_reviewed`, or `approved_for_use`.
- `reviewer`: clinician/reviewer identity or initials when reviewed.
- `reviewedAt` / `date`: review timestamp when reviewed.
- `sourceBasis`: prompt/schema/source/template versions used to create or
  validate the template.
- `version`: review metadata schema version.

## Review status definitions

- `draft`: Generated, imported, or authored but not yet reviewed for use beyond
  an initial draft.
- `clinician_reviewed`: Reviewed by a clinician for clinical content, but not
  yet released as a broadly reusable approved template.
- `approved_for_use`: Approved for reuse under the recorded source category,
  license, and version metadata.

## Future ingestion path for licensed/client-provided templates

Licensed or client-provided templates should be ingested through a controlled
path before being written to `consultassist-sheet-templates`:

1. Intake request
   - Capture customer owner, source category, source name, source URL or
     document identifier, intended use, and whether the content is public,
     licensed, or clinician-authored.
2. License and permission gate
   - Confirm that NEL or other proprietary content is covered by explicit
     customer/rightsholder permission before ingestion.
   - Reject or rewrite any content whose license scope is unclear.
3. Structured normalization
   - Convert the approved material into ConsultAssist's JSON template schema.
   - Preserve source attribution, version/date fields, retrieval date, and
     policy version.
4. Clinical review
   - Store new ingestions as `draft`.
   - Move to `clinician_reviewed` after named clinician review.
   - Move to `approved_for_use` only when clinical and license checks are both
     complete.
5. Publishing and monitoring
   - Store approved templates in the private Supabase template bucket.
   - Include source and template versions in cache keys or metadata.
   - Re-review templates when the underlying source version/date changes.

## Current implementation note

The current MVP's OpenAI-generated and local fallback templates are classified
as `ai_generated_clinical_method` and `clinician_authored_local_template`
respectively. They must not be presented as NEL or exact guideline content
unless a later ingestion path records verified source metadata and approval.
