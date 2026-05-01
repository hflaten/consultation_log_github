# ConsultAssist QA examples for BRC-39/BRC-43

These scenarios cover first-episode triage, a problem that should be handled quickly, and a case that can wait with patient registration and diary advice. Run them in the ConsultAssist UI before release, using Norwegian Bokmål text with characters such as `æ`, `ø`, and `å` preserved in generated output.

Privacy checks for each scenario:

- Do not enter name, fødselsnummer, phone, email, address, or other direct identifiers.
- Confirm the AI request receives an age band and sanitized clinical presentation, not exact age or patient-identifiable contact details.
- Caching/storage policy: confirm localStorage/Supabase cache entries are reusable sheet templates only. Completed answers and generated journal notes must not be cached as reusable templates.
- Confirm the generated journal note is editable before copy/export with **Kopier** or **Eksporter PDF**.

## General verification steps

For each scenario:

1. Enter the age, sex, sheet type, and presenting problem.
2. Click **Lag / hent konsultasjonsark**.
3. Confirm the sheet is practical for a 15-minute GP consultation:
   - Questions and examinations are short, clinically actionable, and not an exhaustive workup.
   - The number of items is feasible to complete during a normal fastlege consultation.
   - Red flags and follow-up advice are easy to find.
4. Select at least one generated answer option under **Undersøkelser** and add a short free-text finding.
5. Click **Lag vurdering**.
6. Verify the **Journalnotat** includes:
   - The presenting problem.
   - Selected/generated examination result options and free-text findings.
   - A clinically useful assessment and plan.
7. Click **Kopier** and paste into a plain-text editor:
   - Norwegian characters (`æ`, `ø`, `å`) must remain intact.
   - Line breaks and bullet structure must remain readable.
8. Click **Eksporter PDF** and use browser print/PDF preview:
   - The journal note is printable/exportable without controls or the consultation sheet cluttering the output.
   - Norwegian characters are still correct in preview/export.

## Scenario 1: First-time dizziness in a 44-year-old male

- **Alder:** `44`
- **Kjønn:** `mann`
- **Arktype:** `minimumsliste`
- **Presenterende problemstilling:**

```text
Mann 44 år med førstegangs svimmelhet siden i dag tidlig. Ingen kjent tidligere svimmelhet. Fastlegen ønsker en minimumsliste over spørsmål og undersøkelser for å avklare alvorlighetsgrad, røde flagg, sannsynlig årsak og plan for videre utredning/oppfølging.
```

Expected QA result:

- The sheet should prioritize first-episode dizziness triage: debut/forløp, vertigo vs presynkope/ustøhet, neurologic symptoms, cardiopulmonary symptoms, medication/substance use, and ear/infection symptoms.
- Examination options should include vital signs, orthostatic blood pressure, neurologic exam, ear/nystagmus assessment, positional testing when relevant, and EKG when indicated.
- A normal or low-risk completion should still give safety-net advice and further evaluation if symptoms persist or worsen.
- The journal note should include selected examination choices, for example:
  - `Allmenntilstand og vitale parametre: Upåfallende. BT 128/82, puls 72, afebril.`
  - `Nevrologisk undersøkelse: Normal. Ingen pareser, ataksi eller talevansker.`

## Scenario 2: Case that should be handled quickly

- **Alder:** `67`
- **Kjønn:** `kvinne`
- **Arktype:** `akuttvurdering`
- **Presenterende problemstilling:**

```text
Kvinne 67 år med akutt innsettende svimmelhet, ny dobbeltsyn, ustø gange og kvalme. Fastlegen trenger rask sortering av røde flagg og hva som bør gjøres nå.
```

Expected QA result:

- The output should clearly frame this as a quickly handled problem because symptoms may represent central neurologic disease or another acute condition.
- Red flags should be prominent and include neurologic deficits, severe/new headache, syncope, chest pain/palpitations, or unstable vital signs when relevant.
- The plan should recommend urgent clinical assessment, emergency conference/admission when indicated, and avoidance of a delayed routine follow-up plan.
- The journal note should remain concise enough for use during a 15-minute consultation while documenting why escalation was considered.

## Scenario 3: Case that can wait with registration and diary advice

- **Alder:** `29`
- **Kjønn:** `kvinne`
- **Arktype:** `oppfølging`
- **Presenterende problemstilling:**

```text
Kvinne 29 år med lette, forbigående episoder med svimmelhet gjennom flere måneder. Ingen brystsmerter, synkope, nevrologiske utfall, hørselstap, feber eller funksjonstap. Hun ønsker råd om hva hun skal registrere før ordinær time.
```

Expected QA result:

- The output should support that this can wait if no red flags emerge.
- Advice should include patient registration before the appointment, for example:
  - diary of episode frequency, duration, triggers, position changes, fluid/food intake, sleep/stress, menstrual relation if relevant, medications, alcohol/substances, and associated symptoms;
  - record pulse if palpitations occur and note any near-syncope;
  - seek faster care if red flags develop.
- The plan should avoid urgent escalation unless new red flags or worsening symptoms are documented.
- The journal note should include the registration/diary advice in the plan and preserve Norwegian text such as `svimmelhet`, `hørselstap`, `forløp`, and `oppfølging`.

## Release checklist

- [ ] First-time dizziness scenario for a 44-year-old male has been run.
- [ ] Quickly handled/urgent scenario has been run and produces escalation-oriented output.
- [ ] Can-wait scenario has been run and produces registration/diary advice plus safety-net guidance.
- [ ] Generated examination result options and free-text findings appear in the journal note.
- [ ] Journal notes remain practical for a 15-minute GP consultation.
- [ ] Copy behavior preserves Norwegian characters and formatting.
- [ ] Browser print/PDF export preserves the journal note and Norwegian characters.
