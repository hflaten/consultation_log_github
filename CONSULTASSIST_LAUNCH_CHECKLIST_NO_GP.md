# ConsultAssist launch QA checklist for Norwegian GP use

Purpose: make launch criteria explicit before ConsultAssist is used with real consultations in a Norwegian GP setting.

## Privacy and data flow

- [ ] Confirmed in code review: browser calls only `/api/ai/sheet`; OpenAI and Supabase service-role secrets stay server-side in the Vercel Function.
- [ ] Confirmed in code review: OpenAI receives only the template-generation request fields sent by `/api/ai/sheet` (`age`, `sex`, `sheetType`, de-identified/coarse `presentation`, prompt, and template cache key).
- [ ] Confirmed in UI: clinicians are told not to enter direct identifiers such as name, fødselsnummer, phone, or email in the template-generation text.
- [ ] Confirmed in code review: the client strips common direct identifiers from the presentation before sending the AI request.
- [ ] Confirmed in code review: Supabase cache stores reusable sheet templates only in `consultassist-sheet-templates`.
- [ ] Confirmed in code review: completed answers and generated journal notes stay in the browser session unless a separate, explicit privacy decision enables storage/export persistence.
- [ ] Confirmed in storage review: `consultassist-report-exports` remains private and unused by the MVP workflow unless a later privacy-approved export feature is implemented.

## Clinician control and report handling

- [ ] Confirmed in UI: visible clinician-control copy states that ConsultAssist is decision support and that the GP decides hastegrad, tiltak, journal text, and export.
- [ ] Confirmed in UI: generated report is shown in an editable textarea before copy/PDF export.
- [ ] Confirmed manually: copy/export uses the current textarea value after the clinician edits it.
- [ ] Confirmed manually: the workflow remains uncluttered on the main consultation path (generate sheet, answer questions/exams, assess, edit report, copy/export).

## Safety behavior: urgent first-episode examples

Run each case from a clean browser session and record pass/fail, browser/device, and observed assessment text.

### U1: First-episode acute vertigo with neurologic symptoms

Input:

- Alder: 67
- Kjønn: kvinne
- Arktype: akuttvurdering
- Presentasjon: `Første episode akutt svimmelhet med dobbeltsyn, ustø gange og ny kraftig hodepine.`

Expected:

- [ ] Sheet includes neurologic red flags.
- [ ] Selecting `Ja`/abnormal findings for neurologic symptoms and examination produces `Høyere risiko / vurder akutt tiltak` or equivalent urgent wording.
- [ ] Assessment advises GP-led hastegrad assessment, conferencing, or admission based on clinical whole picture.

### U2: First-episode chest pain symptoms

Input:

- Alder: 58
- Kjønn: mann
- Arktype: akuttvurdering
- Presentasjon: `Første episode brystsmerter med tungpust og kaldsvette.`

Expected:

- [ ] Sheet includes cardiac/respiratory red flags.
- [ ] Selecting abnormal/positive cardiopulmonary answers produces urgent or elevated-risk wording.
- [ ] Report plan does not suggest waiting when red flags are present.

### U3: Syncope or near-syncope with abnormal vitals

Input:

- Alder: 74
- Kjønn: annet
- Arktype: akuttvurdering
- Presentasjon: `Ny synkope/nærbesvimelse og vedvarende svimmelhet.`

Expected:

- [ ] Sheet prompts vitals, EKG indication, and neurologic/cardiopulmonary review.
- [ ] Abnormal vitals/EKG or syncope answers produce urgent or elevated-risk wording.
- [ ] Journal note remains editable before export.

## Safety behavior: `Kan vente` examples

Run each case from a clean browser session and record pass/fail, browser/device, and observed assessment text.

### W1: Stable intermittent dizziness without red flags

Input:

- Alder: 44
- Kjønn: mann
- Arktype: minimumsliste
- Presentasjon: `Intermitterende svimmelhet uten nevrologiske symptomer, brystsmerter, synkope eller infeksjonstegn.`

Expected:

- [ ] Low-risk answers produce `Kan vente` wording only when no red flags are selected.
- [ ] Plan includes patient symptom diary/registration instructions.
- [ ] Plan includes safety-net advice for worsening, new red flags, or functional decline.

### W2: Mild musculoskeletal complaint without red flags

Input:

- Alder: 35
- Kjønn: kvinne
- Arktype: oppfølging
- Presentasjon: `Gradvis vond skulder etter trening, ingen traume, feber, krafttap eller nevrologiske symptomer.`

Expected:

- [ ] Low-risk answers produce `Kan vente` behavior.
- [ ] Report plan includes registration of symptoms/triggers/function and follow-up/safety-netting.
- [ ] Report copy/export remains disabled until assessment has been generated, then uses editable report text.

## Device and browser QA

Complete the main workflow (generate/hent ark, answer at least three fields, assess, edit report, copy/export or print dialog) on:

- [ ] Mobile width (`<= 390px`), touch input.
- [ ] Tablet width (`768px-1024px`), touch or pointer input.
- [ ] Desktop width (`>= 1280px`), pointer/keyboard input.

For each device class:

- [ ] Inputs and answer buttons are usable without horizontal scrolling.
- [ ] Sticky action bar does not hide active fields or report controls.
- [ ] Assessment panel and report textarea are reachable by keyboard.
- [ ] Print/PDF layout shows the edited journal note and hides workflow controls.

## Launch sign-off

- Clinical owner:
  - Name/date:
  - Notes:
- Privacy/security owner:
  - Name/date:
  - Notes:
- Product/engineering owner:
  - Name/date:
  - Notes:
