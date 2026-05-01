# ConsultAssist launch checklist for Norwegian GP use

Use this checklist before ConsultAssist is used with real consultations in a Norwegian GP workflow.

## Privacy and AI data flow

- [ ] Confirmed that browser clients call only `/api/ai/sheet`; OpenAI and Supabase service-role keys remain server-side.
- [ ] Confirmed that direct identifiers must not be entered in free text and visible workflow copy says so.
- [ ] Confirmed that the client sends an age band, not exact age, to the AI sheet endpoint.
- [ ] Confirmed that common direct identifiers are stripped client-side before AI generation.
- [ ] Confirmed that the server rejects requests containing common direct identifiers that still reach `/api/ai/sheet`.
- [ ] Confirmed that completed consultation answers and generated journal notes are not sent to the AI provider.

## Clinician control and editable output

- [ ] Workflow copy states that ConsultAssist is decision support and that the clinician controls urgency, plan, and journal entry.
- [ ] AI-generated templates are labelled as drafts until a clinician marks the reusable template as reviewed.
- [ ] Generated journal note appears in an editable text area before copy or browser PDF export.
- [ ] Copy/export has been verified after editing the journal note.

## Red-flag and quick-action QA

Run urgent first-episode examples in `consultassist-qa-examples.md`.

- [ ] First-episode dizziness in a 44-year-old male has been run.
- [ ] Urgent dizziness with acute neurologic symptoms has been run.
- [ ] Red flags are prominent in the sheet and assessment.
- [ ] Urgent examples recommend quick clinical action or escalation rather than delayed routine follow-up.

## `Kan vente` QA

Run non-urgent examples in `consultassist-qa-examples.md`.

- [ ] Stable, low-risk example produces `Kan vente` language only when no red flags are selected.
- [ ] Plan includes patient symptom diary/registration before an ordinary appointment.
- [ ] Diary guidance includes frequency, duration, triggers, position changes, fluid/food intake, sleep/stress, medication/substance context, and associated symptoms where relevant.
- [ ] Safety-net advice tells the patient to seek faster care if red flags or worsening symptoms develop.

## Cache and storage policy

- [ ] Supabase `consultassist-sheet-templates` contains reusable sheet templates only.
- [ ] Cache keys use reusable clinical topic, age band, sex, sheet type, language, care setting, and version metadata.
- [ ] Patient-specific completed consults, answers, and journal notes are not stored in the reusable template cache.
- [ ] `consultassist-report-exports` remains private and unused unless a separate privacy decision explicitly allows storing patient-specific exports.

## Device QA for main consultation workflow

Complete end-to-end testing on each target class:

- [ ] Mobile viewport: generate/hent ark, answer questions, create assessment, edit journal note, copy/export.
- [ ] Tablet viewport: generate/hent ark, answer questions, create assessment, edit journal note, copy/export.
- [ ] Desktop viewport: generate/hent ark, answer questions, create assessment, edit journal note, copy/export.
- [ ] Sticky action bar does not block core workflow controls on mobile/tablet.
- [ ] Browser print/PDF output contains the edited journal note and no consultation workflow clutter.

## Launch sign-off

- [ ] Clinical owner:
- [ ] Privacy/security owner:
- [ ] Product/engineering owner:
