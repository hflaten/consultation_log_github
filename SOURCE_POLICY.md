# ConsultAssist Source Policy

ConsultAssist supports Norwegian GP workflow without copying proprietary clinical content.

## Allowed Source Categories

- Public Norwegian guidance from Helsedirektoratet, including national professional guidelines, guides, advice, patient pathways and package pathways, when relevant.
- Public resources indexed through Helsebiblioteket, used as references to locate professional guidance.
- General clinical-method structure taught in medical practice: presenting complaint, history, prior illness, medication/allergies, family/social context, ICE, red flags, targeted examination, assessment and plan.
- Client- or clinician-authored templates that the GP has reviewed and approved.

## Restricted Source Categories

- Do not scrape, copy, paraphrase closely, or store proprietary NEL text unless the client has documented license/permission.
- Do not cache patient-identifiable completed consultations as reusable templates.
- Do not represent AI-generated content as a guideline quote unless the source text has been explicitly supplied and licensed for that use.

## Prompting Rules

- Use Helsedirektoratet and public Norwegian sources as the highest-level source hierarchy when known.
- Use NEL-like GP workflow only as an abstract pattern for how allmennleger structure anamnese and undersøkelse.
- Generated sheets must remain decision support, not diagnosis or autonomous medical advice.
- Each cached sheet should store prompt/schema/source-basis metadata and review status.

## Review Rules

- First generated templates are AI drafts.
- Clinician-reviewed templates should be preferred over unreviewed drafts.
- Reviewed templates should record reviewer, date, prompt/schema/source basis and template version.
