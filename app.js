const SHEET_VERSION = "v1";
const PROMPT_VERSION = "v1";
const SCHEMA_VERSION = "v1";
const SOURCE_VERSION = "openai:gpt-5-mini";
const REVIEWER_STORAGE_KEY = "consultassist-reviewer-name";
const FLOW_HINT_DISMISSED_KEY = "consultassist-flow-hint-dismissed";
const NEURO_SCREENING_FIELDS = [
  ["consciousness", "Bevissthet"],
  ["speech", "Tale"],
  ["face", "Ansikt"],
  ["strength", "Kraft/koordinasjon"],
  ["sensation", "Sensibilitet"],
  ["gait", "Gange"]
];
const NEURO_SCREENING_OPTIONS = ["Normal", "Funn", "Ikke gjort"];

const defaultPrompt = `Du er en klinisk assistent for en fastlege i Norge. Lag en minimumsliste for en konsultasjon basert på pasientpresentasjon og klinisk mål. Listen skal hjelpe legen med å avklare alvorlighetsgrad, røde flagg, differensialdiagnoser og plan for videre utredning/oppfølging.

Input:
- Pasient: alder, kjønn, første episode/kjent problem, tidsramme og relevant kontekst
- Presenterende problemstilling: fri tekst
- Ønsket arktype: minimumsliste for konsultasjon
- Språk: norsk bokmål
- Klinisk ramme: fastlegekontor i Norge
- Kildehierarki: bruk først norske nasjonale faglige retningslinjer, veiledere og faglige råd fra Helsedirektoratet når relevant; bruk Helsebiblioteket som inngang til offentlige fagressurser; bruk NEL-lignende allmennlegeflyt kun som arbeidsmønster, ikke som sitert eller kopiert proprietært innhold.
- Klinisk metode: strukturer spørsmål etter hovedproblem, sykehistorie, tidligere sykdommer, legemidler/allergier, sosial/familie-kontekst, ICE (pasientens tanker, bekymringer og forventninger), røde flagg, målrettet undersøkelse og plan.

Output som JSON:
- sheet_title
- clinical_goal
- red_flags: korte punkter
- questions: liste med { id, section, label, why_it_matters, answer_buttons, free_text_placeholder }
- examinations: liste med { id, section, label, answer_buttons, free_text_placeholder }
- initial_assessment_rules: kort veiledning for alvorlighetsgrad
- follow_up_options: anbefalte neste steg
- journal_note_template: struktur for ferdig journalnotat

Krav:
- Bruk korte, praktiske formuleringer egnet under konsultasjon.
- Ved første episode og 15 minutters konsultasjon: prioriter minimumsliste over det som må avklares nå, ikke bred utredning.
- Hvert spørsmål skal ha relevante svarknapper og et lite fritekstfelt.
- Hvert spørsmål og hver undersøkelse skal ha en section som kan brukes visuelt, f.eks. "Anamnese", "Røde flagg", "ICE", "Undersøkelser" eller "Plan".
- Ikke gi en endelig diagnose. Støtt legens vurdering.
- Assessment skal eksplisitt kunne støtte kategoriene "må håndteres raskt", "kan vente med sikkerhetsnett" og "uklart / trenger mer informasjon".
- Marker røde flagg og når akutt vurdering bør vurderes.`;

const dizzinessTemplate = {
  title: "Svimmelhet - minimumsliste",
  goal: "Avklare alvorlighetsgrad, røde flagg, sannsynlig årsak og behov for videre utredning eller oppfølging.",
  redFlags: [
    "Akutt nevrologisk utfall, ny kraftig hodepine eller synkope",
    "Brystsmerter, tungpust, palpitasjoner eller arytmimistanke",
    "Vedvarende oppkast, dehydrering eller falltendens",
    "Ny hørselstap, alvorlig infeksjonstegn eller nakkestivhet"
  ],
  questions: [
    item("q1", "Debut og forløp", "Skiller akutt alvorlig sykdom fra benign episodisk svimmelhet.", ["Akutt", "Gradvis", "Anfallsvis", "Konstant"], "Når startet det, og hvordan har det utviklet seg?", "Anamnese"),
    item("q2", "Karakter", "Vertigo, presynkope og ustøhet peker mot ulike videre spor.", ["Rotatorisk", "Nær besvimelse", "Ustøhet", "Uklart"], "Pasientens egne ord.", "Anamnese"),
    item("q3", "Utløsende faktorer", "Stillingsutløst svimmelhet kan passe med BPPV.", ["Hodebevegelse", "Reise seg", "Anstrengelse", "Ingen tydelig"], "Hva utløser eller lindrer plagene?", "Anamnese"),
    item("q4", "Nevrologiske symptomer", "Røde flagg for sentral årsak må avklares tidlig.", ["Nei", "Ja", "Usikkert"], "Dobbeltsyn, talevansker, nummenhet, pareser, ataksi.", "Røde flagg"),
    item("q5", "Kardiopulmonale symptomer", "Kan peke mot arytmi, iskemi eller annen akutt somatikk.", ["Nei", "Ja", "Usikkert"], "Brystsmerter, palpitasjoner, tungpust, synkope.", "Røde flagg"),
    item("q6", "Øre-/infeksjonssymptomer", "Hørselstap, tinnitus og infeksjon påvirker vurdering og tiltak.", ["Ingen", "Tinnitus", "Hørselstap", "Infeksjon"], "Øresmerter, feber, nylig luftveisinfeksjon.", "Anamnese"),
    item("q7", "Legemidler og rusmidler", "Bivirkninger og blodtrykksfall er vanlige reversible årsaker.", ["Ingen relevante", "Mulig relevant", "Usikkert"], "Nye medisiner, antihypertensiva, alkohol, andre rusmidler.", "Legemidler og risiko"),
    item("q8", "Pasientens bekymring og forventning", "ICE avklarer hva pasienten trenger svar på i konsultasjonen.", ["Avklart", "Ikke avklart", "Usikkert"], "Tanker, bekymringer og forventninger.", "ICE")
  ],
  examinations: [
    item("e1", "Allmenntilstand og vitale parametre", "Fanger akutt sykdom og sirkulatorisk påvirkning.", ["Upåfallende", "Avvik", "Ikke utført"], "BT, puls, temp, SpO2, respirasjon.", "Undersøkelser"),
    item("e2", "Ortostatisk blodtrykk", "Vurderer ortostatisk hypotensjon.", ["Normal", "Patologisk", "Ikke utført"], "Liggende/stående BT og puls.", "Undersøkelser"),
    item("e3", "Nevrologisk undersøkelse", "Avklarer sentrale tegn.", ["Normal", "Avvik", "Ikke utført"], "Kranialnerver, kraft, sensibilitet, koordinasjon, gange.", "Undersøkelser"),
    item("e4", "Ørestatus og nystagmus", "Støtter perifer vestibulær vurdering.", ["Normal", "Avvik", "Ikke utført"], "Otoskopi, spontan-/blikkretningsnystagmus.", "Undersøkelser"),
    item("e5", "Dix-Hallpike / posisjonstester", "Relevant ved stillingsutløst vertigo.", ["Negativ", "Positiv", "Ikke indisert/utført"], "Side, nystagmus, symptomreproduksjon.", "Undersøkelser"),
    item("e6", "EKG ved indikasjon", "Aktuelt ved synkope, palpitasjoner eller risikoprofil.", ["Normal", "Avvik", "Ikke indisert/utført"], "Rytme, frekvens, ledningsforstyrrelser.", "Undersøkelser")
  ],
  followUp: [
    "Akutt innleggelse/konferering ved nevrologiske utfall, synkope med alarmsymptomer eller ustabil pasient.",
    "BPPV-mistanke: vurder reposisjonsmanøver og kort kontroll ved manglende bedring.",
    "Ortostatisk mistanke: gjennomgå væske, legemidler og BT-kontroll.",
    "Ved vedvarende eller uklar svimmelhet: vurder blodprøver, EKG, audiometri eller henvisning basert på funn."
  ]
};

const genericTemplate = {
  title: "Generelt konsultasjonsark - minimumsliste",
  goal: "Strukturere konsultasjonen, avklare alvorlighet og planlegge videre oppfølging.",
  redFlags: [
    "Akutt funksjonstap eller rask forverring",
    "Sterke smerter, påvirket allmenntilstand eller sirkulatorisk påvirkning",
    "Symptomer som ikke passer med benign forklaring"
  ],
  questions: [
    item("q1", "Debut og varighet", "Tidsforløpet styrer hastegrad og differensialdiagnoser.", ["Akutt", "Subakutt", "Langvarig", "Tilbakevendende"], "Når startet plagene?", "Anamnese"),
    item("q2", "Alvorlighetsgrad og funksjon", "Avklarer hvor mye plagene påvirker pasienten.", ["Lett", "Moderat", "Alvorlig", "Varierende"], "Arbeid, søvn, aktivitet, egenomsorg.", "Anamnese"),
    item("q3", "Ledsagende symptomer", "Finner mønstre og røde flagg.", ["Ingen", "Noen", "Flere", "Usikkert"], "Feber, smerter, vekttap, nevrologi, annet.", "Røde flagg"),
    item("q4", "Tidligere sykdom og risiko", "Setter symptomet i klinisk kontekst.", ["Ingen relevant", "Relevant", "Usikkert"], "Komorbiditet, familiehistorie, graviditet, immunsuppresjon.", "Tidligere sykdom og risiko"),
    item("q5", "Legemidler og tiltak forsøkt", "Avklarer bivirkninger og effekt av egenbehandling.", ["Ingen", "Noe effekt", "Ingen effekt", "Bivirkning"], "Medikamenter, naturmidler, egenbehandling.", "Legemidler og risiko"),
    item("q6", "Pasientens tanker og bekymringer", "ICE hjelper legen å målrette råd og sikkerhetsnett.", ["Avklart", "Ikke avklart", "Usikkert"], "Hva tror pasienten selv, hva bekymrer, hva forventes?", "ICE")
  ],
  examinations: [
    item("e1", "Allmenntilstand og vitale parametre", "Grunnlag for hastegrad.", ["Normal", "Avvik", "Ikke utført"], "BT, puls, temp, SpO2 etter behov.", "Undersøkelser"),
    item("e2", "Målrettet klinisk undersøkelse", "Knytter funn til problemstillingen.", ["Normal", "Avvik", "Ikke utført"], "Beskriv relevante funn.", "Undersøkelser"),
    item("e3", "Supplerende tester ved indikasjon", "Støtter beslutning om videre plan.", ["Ikke indisert", "Utført normal", "Utført avvik"], "Urin, CRP, EKG, blodprøver eller annet.", "Undersøkelser")
  ],
  followUp: [
    "Akutt tiltak ved røde flagg eller påvirket pasient.",
    "Planlegg kontroll dersom symptomer vedvarer, forverres eller diagnosen er usikker.",
    "Gi tydelige råd om når pasienten skal ta kontakt raskt."
  ]
};

const state = {
  sheet: null,
  answers: {},
  assessment: null,
  assessmentHidden: false,
  assessmentStale: false,
  stickyDismissed: false,
  nearTop: true,
  setupCollapsed: false,
  viewMode: "focus",
  activeItemIndex: 0
};

const STICKY_TOP_HIDE_OFFSET = 160;

const els = {
  age: document.querySelector("#ageInput"),
  sex: document.querySelector("#sexInput"),
  sheetType: document.querySelector("#sheetType"),
  firstEpisode: document.querySelector("#firstEpisodeInput"),
  timeBudget: document.querySelector("#timeBudgetInput"),
  patientId: document.querySelector("#patientIdInput"),
  caseInput: document.querySelector("#caseInput"),
  setupPanel: document.querySelector("#setupPanel"),
  setupSummary: document.querySelector("#setupSummary"),
  setupSummaryText: document.querySelector("#setupSummaryText"),
  editSetup: document.querySelector("#editSetup"),
  generate: document.querySelector("#generateSheet"),
  example: document.querySelector("#loadExample"),
  clear: document.querySelector("#clearSession"),
  flowHint: document.querySelector("#flowHint"),
  dismissFlowHint: document.querySelector("#dismissFlowHint"),
  cacheStatus: document.querySelector("#cacheStatus"),
  completionStatus: document.querySelector("#completionStatus"),
  reviewStatus: document.querySelector("#reviewStatus"),
  sheetSubtitle: document.querySelector("#sheetSubtitle"),
  patientContextBar: document.querySelector("#patientContextBar"),
  patientContextText: document.querySelector("#patientContextText"),
  generatedAtText: document.querySelector("#generatedAtText"),
  reviewBanner: document.querySelector("#reviewBanner"),
  reviewLabel: document.querySelector("#reviewLabel"),
  reviewMeta: document.querySelector("#reviewMeta"),
  reviewTemplate: document.querySelector("#reviewTemplate"),
  sheetContainer: document.querySelector("#sheetContainer"),
  postSheetActions: document.querySelector("#postSheetActions"),
  customQuestionInput: document.querySelector("#customQuestionInput"),
  customQuestionType: document.querySelector("#customQuestionType"),
  addCustomQuestion: document.querySelector("#addCustomQuestion"),
  nextPatient: document.querySelector("#nextPatient"),
  summaryPanel: document.querySelector(".summary-panel"),
  assessmentFreshness: document.querySelector("#assessmentFreshness"),
  showAssessment: document.querySelector("#showAssessment"),
  hideAssessment: document.querySelector("#hideAssessment"),
  assess: document.querySelector("#assessButton"),
  risk: document.querySelector("#riskPanel"),
  flowControls: document.querySelector("#flowControls"),
  showAllMode: document.querySelector("#showAllMode"),
  focusMode: document.querySelector("#focusMode"),
  previousItem: document.querySelector("#previousItem"),
  nextItem: document.querySelector("#nextItem"),
  activeItemStatus: document.querySelector("#activeItemStatus"),
  report: document.querySelector("#reportOutput"),
  copy: document.querySelector("#copyReport"),
  pdf: document.querySelector("#exportPdf"),
  stickyBar: document.querySelector("#stickyActionBar"),
  stickyCount: document.querySelector("#stickyCompletionCount"),
  stickyPercent: document.querySelector("#stickyCompletionPercent"),
  stickyAssess: document.querySelector("#stickyAssessButton"),
  stickyViewAssessment: document.querySelector("#stickyViewAssessment"),
  stickyDismiss: document.querySelector("#dismissStickyBar")
};

els.generate.addEventListener("click", generateSheet);
els.example.addEventListener("click", () => {
  els.age.value = "44";
  els.sex.value = "mann";
  els.sheetType.value = "minimumsliste";
  els.firstEpisode.value = "ja";
  els.timeBudget.value = "15";
  els.patientId.value = "";
  els.caseInput.value = "Svimmelhet siden i går, første episode. Ønsker minimumsliste for 15 min konsultasjon.";
  updateFlowHint();
});
els.clear.addEventListener("click", prepareNextPatient);
els.editSetup.addEventListener("click", () => setSetupCollapsed(false));
els.showAssessment.addEventListener("click", () => setAssessmentHidden(false));
els.hideAssessment.addEventListener("click", () => setAssessmentHidden(true));
els.showAllMode.addEventListener("click", () => setViewMode("all"));
els.focusMode.addEventListener("click", () => setViewMode("focus"));
els.previousItem.addEventListener("click", () => moveActiveItem(-1));
els.nextItem.addEventListener("click", () => moveActiveItem(1));
els.addCustomQuestion.addEventListener("click", addCustomQuestion);
els.nextPatient.addEventListener("click", prepareNextPatient);
els.reviewTemplate.addEventListener("click", approveTemplate);
els.dismissFlowHint.addEventListener("click", () => {
  localStorage.setItem(FLOW_HINT_DISMISSED_KEY, "true");
  updateFlowHint();
});
els.assess.addEventListener("click", assess);
els.stickyAssess.addEventListener("click", assess);
els.stickyViewAssessment.addEventListener("click", scrollToAssessment);
els.stickyDismiss.addEventListener("click", () => {
  state.stickyDismissed = true;
  updateStickyActionBar();
});
els.copy.addEventListener("click", copyReport);
els.pdf.addEventListener("click", () => window.print());
[els.age, els.sex, els.sheetType, els.firstEpisode, els.timeBudget, els.patientId, els.caseInput].forEach((input) => {
  input.addEventListener("input", updateFlowHint);
  input.addEventListener("change", updateFlowHint);
});
window.addEventListener("scroll", updateStickyPosition, { passive: true });
window.addEventListener("resize", updateStickyPosition);
document.addEventListener("keydown", handleGlobalKeydown);
updateFlowHint();
updateStickyPosition();

function item(id, label, why, buttons, placeholder, section = "Anamnese") {
  return { id, label, why, buttons, placeholder, section };
}

function normalizeTopic(text) {
  const lower = text.toLowerCase();
  if (lower.includes("svimmel") || lower.includes("vertigo")) return "svimmelhet";
  return lower.split(/[.,\n]/)[0].replace(/[^a-zæøå0-9 ]/gi, "").trim().slice(0, 60) || "generelt";
}

function sentenceCase(value) {
  const trimmed = String(value).replace(/\s+/g, " ").trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : "Ekstra punkt";
}

function cacheKey() {
  const age = Number.parseInt(els.age.value, 10);
  const ageBand = Number.isFinite(age) ? `${Math.floor(age / 10) * 10}-${Math.floor(age / 10) * 10 + 9}` : "ukjent";
  return [
    "consultassist-sheet",
    SHEET_VERSION,
    normalizeTopic(els.caseInput.value),
    ageBand,
    els.sex.value,
    els.sheetType.value,
    els.firstEpisode.value,
    `${els.timeBudget.value}-min`,
    "nb-no",
    "fastlege"
  ].join(":");
}

async function generateSheet() {
  const key = cacheKey();
  const cached = localStorage.getItem(key);
  if (cached) {
    state.sheet = JSON.parse(cached);
    ensureReviewMetadata(state.sheet, sourceBasis());
    if (!isCurrentSourceBasis(state.sheet.review.sourceBasis, sourceBasis())) {
      localStorage.removeItem(key);
      state.sheet = null;
      return generateSheet();
    }
    els.cacheStatus.textContent = cacheStatusForSheet(state.sheet, "lokal cache");
  } else {
    els.generate.disabled = true;
    els.cacheStatus.textContent = "Lager spesialisert ark med AI";
    try {
      state.sheet = await generateAiSheet(key);
      localStorage.setItem(key, JSON.stringify(state.sheet));
    } catch (error) {
      console.warn("AI generation failed, using local fallback:", error);
      const base = normalizeTopic(els.caseInput.value) === "svimmelhet" ? dizzinessTemplate : genericTemplate;
      state.sheet = structuredClone(base);
      state.sheet.cacheKey = key;
      state.sheet.createdAt = new Date().toISOString();
      state.sheet.source = "local_fallback";
      state.sheet.review = buildDraftReviewMetadata(sourceBasis(), "local_fallback");
      localStorage.setItem(key, JSON.stringify(state.sheet));
      els.cacheStatus.textContent = "AI utilgjengelig - lokal fallback brukt";
    } finally {
      els.generate.disabled = false;
    }
  }
  state.answers = {};
  state.assessment = null;
  state.assessmentHidden = false;
  state.assessmentStale = false;
  state.stickyDismissed = false;
  state.viewMode = "focus";
  state.activeItemIndex = 0;
  renderSheet();
  updateCompletion();
  resetReport();
  updateFlowHint();
}

async function generateAiSheet(key) {
  const response = await fetch("/api/ai/sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      age: els.age.value,
      sex: els.sex.value,
      sheetType: els.sheetType.value,
      firstEpisode: els.firstEpisode.value,
      timeBudgetMinutes: els.timeBudget.value,
      presentation: els.caseInput.value,
      prompt: defaultPrompt,
      cacheKey: key,
      sourceBasis: sourceBasis()
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI request failed ${response.status}: ${text.slice(0, 240)}`);
  }

  const data = await response.json();
  if (!data.sheet) throw new Error("API response did not contain a sheet");
  els.cacheStatus.textContent = cacheStatusForSheet(data.sheet, data.cacheHit ? "Supabase cache" : "Supabase cache");
  return data.sheet;
}

async function addCustomQuestion() {
  if (!state.sheet) return;
  const rawText = els.customQuestionInput.value.trim();
  if (!rawText) {
    els.customQuestionInput.focus();
    return;
  }

  const targetKey = els.customQuestionType.value === "examinations" ? "examinations" : "questions";
  const id = `custom-${Date.now().toString(36)}`;
  els.addCustomQuestion.disabled = true;
  els.cacheStatus.textContent = "Forbedrer ekstra punkt med AI";

  try {
    const entry = await refineCustomQuestion(rawText, targetKey, id);
    state.sheet[targetKey].push(entry);
    markSheetModified();
    state.answers[id] = {};
    state.activeItemIndex = itemIndex(id);
    els.customQuestionInput.value = "";
    localStorage.setItem(state.sheet.cacheKey || cacheKey(), JSON.stringify(state.sheet));
    els.cacheStatus.textContent = "Ekstra punkt lagt til";
    renderSheet();
    updateCompletion();
    focusActiveItemControl();
  } catch (error) {
    console.warn("Custom question refinement failed:", error);
    const entry = fallbackCustomQuestion(rawText, targetKey, id);
    state.sheet[targetKey].push(entry);
    markSheetModified();
    state.answers[id] = {};
    state.activeItemIndex = itemIndex(id);
    els.customQuestionInput.value = "";
    localStorage.setItem(state.sheet.cacheKey || cacheKey(), JSON.stringify(state.sheet));
    els.cacheStatus.textContent = "Ekstra punkt lagt til med lokal opprydding";
    renderSheet();
    updateCompletion();
    focusActiveItemControl();
  } finally {
    els.addCustomQuestion.disabled = false;
  }
}

async function refineCustomQuestion(rawText, targetKey, id) {
  const response = await fetch("/api/ai/sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "refine_item",
      rawText,
      itemType: targetKey,
      id,
      sheetTitle: state.sheet.title,
      presentation: els.caseInput.value
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Custom item request failed ${response.status}: ${text.slice(0, 240)}`);
  }

  const data = await response.json();
  if (!data.item) throw new Error("Custom item response did not contain an item");
  return normalizeCustomEntry(data.item, rawText, targetKey, id);
}

function normalizeCustomEntry(entry, rawText, targetKey, id) {
  const fallback = fallbackCustomQuestion(rawText, targetKey, id);
  return {
    id,
    section: entry.section || fallback.section,
    label: entry.label || fallback.label,
    why: entry.why || fallback.why,
    buttons: Array.isArray(entry.buttons) && entry.buttons.length >= 2 ? entry.buttons.slice(0, 5) : fallback.buttons,
    placeholder: entry.placeholder || fallback.placeholder
  };
}

function fallbackCustomQuestion(rawText, targetKey, id) {
  const isExam = targetKey === "examinations";
  const label = sentenceCase(rawText).slice(0, 120);
  return item(
    id,
    label,
    isExam ? "Lagt til av kliniker som målrettet undersøkelsespunkt." : "Lagt til av kliniker som relevant avklaringspunkt.",
    isExam ? ["Normal", "Avvik", "Ikke utført"] : ["Ja", "Nei", "Usikkert"],
    isExam ? "Beskriv funn kort." : "Utfyllende detaljer ved behov.",
    isExam ? "Undersøkelser" : "Tillegg"
  );
}

function markSheetModified() {
  if (!state.sheet) return;
  state.sheet.source = "clinician_modified";
  state.sheet.review = buildDraftReviewMetadata(sourceBasis(), "clinician_modified");
}

function renderSheet() {
  const sheet = state.sheet;
  clampActiveItemIndex();
  els.sheetSubtitle.textContent = sheet.goal;
  els.patientContextBar.hidden = false;
  els.patientContextText.textContent = patientContextText();
  els.generatedAtText.textContent = `Generert ${formatDateTime(sheet.createdAt || new Date().toISOString())}`;
  updateReviewUi();
  els.sheetContainer.className = state.viewMode === "focus" ? "focus-mode" : "";
  els.sheetContainer.innerHTML = [
    `<h3 class="sheet-title">${escapeHtml(sheet.title)}</h3>`,
    renderGroupedSections("Spørsmål", sheet.questions),
    renderGroupedSections("Undersøkelser", sheet.examinations)
  ].join("");

  document.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("focusin", () => setActiveItemById(card.dataset.id, false));
    card.addEventListener("click", () => setActiveItemById(card.dataset.id, false));
  });

  document.querySelectorAll(".answer-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectAnswer(button);
    });
    button.addEventListener("keydown", handleAnswerKeydown);
    button.setAttribute("aria-checked", "false");
    button.setAttribute("role", "radio");
    button.tabIndex = 0;
  });

  document.querySelectorAll(".button-row").forEach((row) => {
    row.setAttribute("role", "radiogroup");
    row.setAttribute("aria-label", row.dataset.label || "Svarvalg");
  });

  document.querySelectorAll(".item-card").forEach((card) => {
    const id = card.dataset.id;
    card.classList.toggle("answered", Boolean(hasAnswer(id)));
    card.classList.toggle("unanswered", !hasAnswer(id));
  });

  Object.entries(state.answers).forEach(([id, answer]) => {
    if (answer.neuro) {
      Object.entries(answer.neuro).forEach(([key, value]) => {
        document.querySelectorAll(`.answer-button[data-id="${id}"][data-neuro-key="${key}"]`).forEach((button) => {
          const isActive = button.dataset.value === value;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-checked", isActive ? "true" : "false");
        });
      });
      return;
    }
    if (!answer.choice) return;
    document.querySelectorAll(`.answer-button[data-id="${id}"]`).forEach((button) => {
      const isActive = button.dataset.value === answer.choice;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  });

  document.querySelectorAll(".free-text").forEach((input) => {
    const existing = state.answers[input.dataset.id]?.text;
    if (existing) input.value = existing;
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      state.answers[id] = state.answers[id] || {};
      state.answers[id].text = input.value.trim();
      markAssessmentStale();
      updateCompletion();
    });
  });

  setSetupCollapsed(true);
  updateFlowControls();
  updatePostSheetActions();
  setTimeout(() => els.sheetContainer.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

async function approveTemplate() {
  if (!state.sheet) return;
  if (!isSheetComplete()) {
    els.cacheStatus.textContent = "Gå gjennom hele arket før malen godkjennes";
    return;
  }

  const reviewer = window.prompt("Navn/initialer på kliniker som har gjennomgått arket:", localStorage.getItem(REVIEWER_STORAGE_KEY) || "");
  if (!reviewer || reviewer.trim().length === 0) return;

  localStorage.setItem(REVIEWER_STORAGE_KEY, reviewer.trim());
  els.reviewTemplate.disabled = true;
  els.cacheStatus.textContent = "Lagrer klinisk godkjenning";

  try {
    const response = await fetch("/api/ai/sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review",
        cacheKey: state.sheet.cacheKey || cacheKey(),
        reviewer: reviewer.trim(),
        sheet: state.sheet,
        sourceBasis: sourceBasisForSheet(state.sheet)
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Review request failed ${response.status}: ${text.slice(0, 240)}`);
    }

    const data = await response.json();
    state.sheet = data.sheet;
    localStorage.setItem(state.sheet.cacheKey, JSON.stringify(state.sheet));
    els.cacheStatus.textContent = "Klinisk godkjent mal lagret";
    updateReviewUi();
    updatePostSheetActions();
  } catch (error) {
    console.warn("Template review failed:", error);
    els.cacheStatus.textContent = "Kunne ikke lagre godkjenning";
  } finally {
    els.reviewTemplate.disabled = false;
  }
}

function updateReviewUi() {
  if (!state.sheet) {
    els.reviewStatus.textContent = "Ikke vurdert";
    els.reviewStatus.className = "";
    els.reviewBanner.hidden = true;
    return;
  }

  ensureReviewMetadata(state.sheet, sourceBasis());
  const review = state.sheet.review;
  const isReviewed = review.status === "reviewed";
  els.reviewStatus.textContent = isReviewed ? "Kliniker-godkjent mal" : "AI-utkast";
  els.reviewStatus.className = isReviewed ? "reviewed-status" : "draft-status";
  els.reviewBanner.hidden = false;
  els.reviewBanner.className = `review-banner ${isReviewed ? "reviewed" : "draft"}`;
  els.reviewLabel.textContent = isReviewed ? "Kliniker-godkjent mal" : "AI-utkast - ikke klinisk godkjent";
  els.reviewMeta.textContent = isReviewed ? reviewSummary(review) : `${reviewSummary(review)} Gå gjennom hele arket og legg til eventuelle manglende punkter før godkjenning.`;
  els.reviewTemplate.hidden = isReviewed;
  els.reviewTemplate.disabled = !isSheetComplete();
}

function cacheStatusForSheet(sheet, sourceLabel) {
  ensureReviewMetadata(sheet, sourceBasis());
  return sheet.review.status === "reviewed"
    ? `Hentet kliniker-godkjent mal fra ${sourceLabel}`
    : `Hentet AI-utkast fra ${sourceLabel}`;
}

function reviewSummary(review) {
  const basis = review.sourceBasis || {};
  if (review.status === "reviewed") {
    const date = review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString("nb-NO") : "ukjent dato";
    return `Gjennomgått av ${review.reviewer || "ukjent kliniker"} ${date}. Basis: prompt ${basis.promptVersion || "ukjent"}, skjema ${basis.schemaVersion || "ukjent"}, kilde ${basis.sourceVersion || "ukjent"}.`;
  }

  return `Første genererte mal kan brukes som utkast, men må godkjennes før langtidsbruk. Basis: prompt ${basis.promptVersion || "ukjent"}, skjema ${basis.schemaVersion || "ukjent"}, kilde ${basis.sourceVersion || "ukjent"}.`;
}

function ensureReviewMetadata(sheet, fallbackBasis) {
  sheet.review = {
    status: sheet.review?.status === "reviewed" ? "reviewed" : "unreviewed",
    reviewer: sheet.review?.reviewer || null,
    reviewedAt: sheet.review?.reviewedAt || null,
    sourceBasis: sheet.review?.sourceBasis || fallbackBasis,
    version: sheet.review?.version || "review-v1"
  };
}

function buildDraftReviewMetadata(basis, source) {
  return {
    status: "unreviewed",
    reviewer: null,
    reviewedAt: null,
    sourceBasis: {
      ...basis,
      generatedSource: source
    },
    version: "review-v1"
  };
}

function sourceBasisForSheet(sheet) {
  ensureReviewMetadata(sheet, sourceBasis());
  return sheet.review.sourceBasis;
}

function sourceBasis() {
  return {
    promptHash: stableHash(defaultPrompt),
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    sourceVersion: SOURCE_VERSION,
    templateVersion: SHEET_VERSION
  };
}

function isCurrentSourceBasis(existingBasis, currentBasis) {
  if (!existingBasis || !currentBasis) return false;
  return ["promptHash", "promptVersion", "schemaVersion", "sourceVersion", "templateVersion"]
    .every((key) => existingBasis[key] === currentBasis[key]);
}

function stableHash(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function renderGroupedSections(title, items) {
  const visibleItems = state.viewMode === "focus" ? items.filter((entry) => entry.id === activeItem()?.id) : items;
  if (visibleItems.length === 0) return "";
  const groups = groupBySection(visibleItems);
  return `<div class="sheet-section"><h3>${escapeHtml(title)}</h3>${Object.entries(groups).map(([section, entries]) => `
    <section class="sheet-subsection" aria-label="${escapeHtml(section)}">
      <div class="subsection-heading">
        <span>${escapeHtml(section)}</span>
        <small>${entries.length} punkt</small>
      </div>
      ${entries.map(renderItem).join("")}
    </section>
  `).join("")}</div>`;
}

function groupBySection(items) {
  return items.reduce((groups, entry) => {
    const section = entry.section || "Anamnese";
    groups[section] = groups[section] || [];
    groups[section].push(entry);
    return groups;
  }, {});
}

function renderItem(entry) {
  const answered = hasAnswer(entry.id);
  if (isNeurologicalEntry(entry)) return renderNeurologicalItem(entry, answered);
  const index = itemIndex(entry.id);
  return `<article class="item-card ${answered ? "answered" : "unanswered"}" data-id="${escapeHtml(entry.id)}">
    <div class="item-title">
      <strong><span class="item-number">${index + 1}</span>${escapeHtml(entry.label)}</strong>
      <span>${escapeHtml(entry.why)}</span>
    </div>
    <div class="button-row" data-label="${escapeHtml(entry.label)}">
      ${entry.buttons.map((button, optionIndex) => `<button class="answer-button" type="button" data-option-index="${optionIndex + 1}" data-id="${escapeHtml(entry.id)}" data-value="${escapeHtml(button)}"><span class="shortcut-number">${optionIndex + 1}</span>${escapeHtml(button)}</button>`).join("")}
    </div>
    <input class="free-text" data-id="${escapeHtml(entry.id)}" placeholder="${escapeHtml(entry.placeholder)}">
  </article>`;
}

function renderNeurologicalItem(entry, answered) {
  const index = itemIndex(entry.id);
  const answer = state.answers[entry.id] || {};
  const neuro = answer.neuro || {};
  return `<article class="item-card neuro-card ${answered ? "answered" : "unanswered"}" data-id="${escapeHtml(entry.id)}">
    <div class="item-title">
      <strong><span class="item-number">${index + 1}</span>${escapeHtml(entry.label)}</strong>
      <span>${escapeHtml(entry.why)}</span>
    </div>
    <div class="neuro-grid" role="group" aria-label="${escapeHtml(entry.label)}">
      ${NEURO_SCREENING_FIELDS.map(([key, label]) => `
        <div class="neuro-row">
          <span>${escapeHtml(label)}</span>
          <div class="button-row neuro-options" data-label="${escapeHtml(label)}">
            ${NEURO_SCREENING_OPTIONS.map((option, optionIndex) => `<button class="answer-button neuro-button ${neuro[key] === option ? "active" : ""}" type="button" data-option-index="${optionIndex + 1}" data-id="${escapeHtml(entry.id)}" data-neuro-key="${escapeHtml(key)}" data-value="${escapeHtml(option)}"><span class="shortcut-number">${optionIndex + 1}</span>${escapeHtml(option)}</button>`).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    <input class="free-text" data-id="${escapeHtml(entry.id)}" placeholder="Samlet nevrologisk funn / fokalnevrologi">
  </article>`;
}

function selectAnswer(button) {
  const id = button.dataset.id;
  state.answers[id] = state.answers[id] || {};
  if (button.dataset.neuroKey) {
    state.answers[id].neuro = state.answers[id].neuro || {};
    state.answers[id].neuro[button.dataset.neuroKey] = button.dataset.value;
    state.answers[id].choice = neurologicalChoice(state.answers[id].neuro);
    button.closest(".neuro-options").querySelectorAll(".answer-button").forEach((candidate) => {
      const isActive = candidate === button;
      candidate.classList.toggle("active", isActive);
      candidate.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  } else {
    state.answers[id].choice = button.dataset.value;
    document.querySelectorAll(`.answer-button[data-id="${id}"]`).forEach((candidate) => {
      const isActive = candidate === button;
      candidate.classList.toggle("active", isActive);
      candidate.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  }
  markAssessmentStale();
  updateCompletion();
}

function handleAnswerKeydown(event) {
  const key = event.key;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter", " "].includes(key)) return;

  if (state.viewMode === "focus") {
    if (key === "Enter" || key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      moveActiveItem(1);
      return;
    }

    if (key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      moveActiveItem(-1);
      return;
    }
  }

  const buttons = [...event.currentTarget.closest(".button-row").querySelectorAll(".answer-button")];
  const index = buttons.indexOf(event.currentTarget);

  if (key === "Enter" || key === " ") {
    event.preventDefault();
    selectAnswer(event.currentTarget);
    return;
  }

  event.preventDefault();
  const nextIndex = key === "Home"
    ? 0
    : key === "End"
      ? buttons.length - 1
      : (index + (key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
  buttons[nextIndex].focus();
}

function handleGlobalKeydown(event) {
  if (!state.sheet) return;
  const target = event.target;
  const isTextInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  if (isTextInput) return;

  if (/^[1-5]$/.test(event.key)) {
    const active = activeItem();
    if (!active) return;
    const scope = activeCardElement(active.id);
    const row = activeShortcutRow(scope);
    const button = row?.querySelector(`.answer-button[data-option-index="${event.key}"]`);
    if (!button) return;
    event.preventDefault();
    selectAnswer(button);
    return;
  }

  if (event.key === "Enter" && state.viewMode === "focus") {
    event.preventDefault();
    moveActiveItem(1);
    return;
  }

  if (event.key === "Escape" && state.viewMode === "focus") {
    event.preventDefault();
    setViewMode("all");
    return;
  }

  if (event.key === "ArrowRight" && state.viewMode === "focus") {
    event.preventDefault();
    moveActiveItem(1);
  }

  if (event.key === "ArrowLeft" && state.viewMode === "focus") {
    event.preventDefault();
    moveActiveItem(-1);
  }
}

function updateCompletion() {
  if (!state.sheet) {
    els.completionStatus.textContent = "Ingen svar registrert";
    els.assess.disabled = true;
    els.assess.hidden = true;
    els.stickyCount.textContent = "0 / 0 spørsmål besvart";
    els.stickyPercent.textContent = "0%";
    els.stickyAssess.disabled = true;
    els.stickyAssess.hidden = true;
    updateStickyActionBar();
    return;
  }
  const { completed, total, percent } = getCompletion();
  const hasStartedAnswers = completed > 0;
  els.completionStatus.textContent = `${completed} / ${total} svar registrert (${percent}%)`;
  els.assess.hidden = !hasStartedAnswers;
  els.assess.disabled = !hasStartedAnswers;
  els.stickyCount.textContent = `${completed} / ${total} spørsmål besvart`;
  els.stickyPercent.textContent = `${percent}%`;
  els.stickyAssess.hidden = !hasStartedAnswers;
  els.stickyAssess.disabled = els.assess.disabled;
  document.querySelectorAll(".item-card").forEach((card) => {
    const answered = Boolean(hasAnswer(card.dataset.id));
    card.classList.toggle("answered", answered);
    card.classList.toggle("unanswered", !answered);
  });
  updateStickyActionBar();
  updateAssessmentControls();
  updateFlowControls();
  updatePostSheetActions();
}

function assess() {
  if (!state.sheet || els.assess.disabled) return;
  const values = Object.values(state.answers).map((answer) => `${answer.choice || ""} ${answer.text || ""}`.toLowerCase());
  const redFlagHits = values.filter((value) => /ja|avvik|synkope|bryst|pares|dobbeltsyn|tale|hodepine|hørselstap|patologisk/.test(value));
  const missingCritical = missingCriticalAnswers();
  const risk = redFlagHits.length >= 2 ? "high" : redFlagHits.length === 1 || missingCritical.length > 0 ? "medium" : "low";
  const urgency = urgencyForRisk(risk, missingCritical);
  const title = urgency.title;

  state.assessment = { risk, title, urgency: urgency.category, missingCritical };
  state.assessmentHidden = false;
  state.assessmentStale = false;
  els.risk.className = `risk-panel ${risk}`;
  els.risk.innerHTML = `<div class="urgency-kicker">${escapeHtml(urgency.category)}</div><strong>${title}</strong><p>${riskText(risk, missingCritical)}</p>${missingCritical.length ? `<p><strong>Mangler før trygg vurdering:</strong> ${missingCritical.map(escapeHtml).join(", ")}</p>` : ""}<strong>Røde flagg å kontrollere:</strong><ul>${state.sheet.redFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}</ul>`;
  els.report.value = buildReport();
  els.copy.disabled = false;
  els.pdf.disabled = false;
  updateStickyActionBar();
  updateAssessmentControls();
  scrollToAssessment();
}

function urgencyForRisk(risk, missingCritical) {
  if (risk === "high") {
    return {
      category: "Må håndteres raskt",
      title: "Høyere risiko / vurder tiltak samme dag"
    };
  }
  if (risk === "medium") {
    return {
      category: missingCritical.length ? "Uklart / trenger mer informasjon" : "Målrettet oppfølging",
      title: missingCritical.length ? "Uklart - fyll ut kritiske punkter før endelig plan" : "Moderat risiko / målrettet oppfølging"
    };
  }
  return {
    category: "Kan vente med sikkerhetsnett",
    title: "Lavere risiko ut fra utfylte svar"
  };
}

function riskText(risk, missingCritical = []) {
  if (risk === "high") return "Funn eller svar kan passe med røde flagg. Legen bør vurdere hastegrad, konferering eller innleggelse ut fra klinisk helhet.";
  if (risk === "medium" && missingCritical.length) return "Flere sikkerhetskritiske punkter mangler. Avklar disse før pasienten får et vente-/egenregistreringsråd.";
  if (risk === "medium") return "Noen usikre eller avvikende svar foreligger. Vurder målrettet undersøkelse, supplerende tester og tydelig sikkerhetsnett.";
  return "Ingen tydelige røde flagg er registrert i utfylt ark. Tilstanden kan vanligvis avvente planlagt oppfølging med tydelig sikkerhetsnett og eventuell registrering av videre symptomer.";
}

function buildReport() {
  const entries = [...state.sheet.questions, ...state.sheet.examinations].map((entry) => {
    return `- ${entry.label}: ${formatAnswer(entry)}`;
  }).join("\n");

  return `Journalnotat - ${state.sheet.title}

Problemstilling:
${els.caseInput.value.trim()}

Opplysninger og funn:
${entries}

Vurdering:
${state.assessment.urgency}: ${state.assessment.title}. ${riskText(state.assessment.risk, state.assessment.missingCritical)}

Plan:
${state.sheet.followUp.map((line) => `- ${line}`).join("\n")}

Merknad:
Teksten er beslutningsstøtte og må kvalitetssikres av lege før den lagres i journal.`;
}

async function copyReport() {
  await navigator.clipboard.writeText(els.report.value);
  els.cacheStatus.textContent = "Journalnotat kopiert";
}

function clearAnswers() {
  state.answers = {};
  state.assessment = null;
  state.assessmentHidden = false;
  state.assessmentStale = false;
  state.stickyDismissed = false;
  if (state.sheet) renderSheet();
  updateCompletion();
  resetReport();
}

function prepareNextPatient() {
  state.sheet = null;
  state.answers = {};
  state.assessment = null;
  state.assessmentHidden = false;
  state.assessmentStale = false;
  state.stickyDismissed = false;
  state.setupCollapsed = false;
  state.viewMode = "focus";
  state.activeItemIndex = 0;
  els.patientId.value = "";
  els.caseInput.value = "";
  els.setupPanel.classList.remove("collapsed");
  els.setupSummary.hidden = true;
  els.patientContextBar.hidden = true;
  els.reviewBanner.hidden = true;
  els.postSheetActions.hidden = true;
  els.sheetSubtitle.textContent = "Ingen ark generert ennå.";
  els.sheetContainer.className = "empty-state";
  els.sheetContainer.innerHTML = `<div class="empty-state-content">
    <span class="empty-state-arrow" aria-hidden="true">&uarr;</span>
    <strong>Start med å lage et konsultasjonsark.</strong>
    <span>Bruk knappen "Lag / hent konsultasjonsark" over, og fyll deretter ut svarene her.</span>
  </div>`;
  els.cacheStatus.textContent = "Klar for neste pasient";
  els.reviewStatus.textContent = "Ikke vurdert";
  els.reviewStatus.className = "";
  updateCompletion();
  resetReport();
  updateFlowControls();
  updateFlowHint();
  els.caseInput.focus();
}

function resetReport() {
  els.risk.className = "risk-panel muted";
  els.risk.textContent = state.sheet ? "Fyll ut noen svar i arket for å lage vurdering." : "Lag et konsultasjonsark først, fyll det ut, og hent deretter vurdering.";
  els.report.value = "";
  els.copy.disabled = true;
  els.pdf.disabled = true;
  updateAssessmentControls();
  updateStickyActionBar();
}

function getCompletion() {
  const allItems = state.sheet ? [...state.sheet.questions, ...state.sheet.examinations] : [];
  const completed = allItems.filter((entry) => hasAnswer(entry.id)).length;

  return {
    completed,
    total: allItems.length,
    percent: allItems.length ? Math.round((completed / allItems.length) * 100) : 0
  };
}

function isSheetComplete() {
  if (!state.sheet) return false;
  const { completed, total } = getCompletion();
  return total > 0 && completed === total;
}

function hasAnswer(id) {
  const answer = state.answers[id];
  if (!answer) return false;
  if (answer.neuro) {
    return NEURO_SCREENING_FIELDS.every(([key]) => Boolean(answer.neuro[key])) || Boolean(answer.text);
  }
  return answer.choice || answer.text;
}

function missingCriticalAnswers() {
  if (!state.sheet) return [];
  const criticalTerms = /rød|nevrolog|kardio|bryst|synkope|allmenntilstand|vital|undersøkelse|akutt/i;
  return [...state.sheet.questions, ...state.sheet.examinations]
    .filter((entry) => criticalTerms.test(`${entry.section || ""} ${entry.label}`) && !hasAnswer(entry.id))
    .slice(0, 4)
    .map((entry) => entry.label);
}

function isNeurologicalEntry(entry) {
  return /nevrologisk (screening|undersøkelse)|nevrologisk/i.test(entry.label);
}

function neurologicalChoice(neuro) {
  const values = Object.values(neuro || {});
  if (values.length === 0) return "";
  if (NEURO_SCREENING_FIELDS.every(([key]) => neuro[key] === "Normal")) return "Normal";
  if (values.includes("Funn")) return "Funn";
  if (values.includes("Ikke gjort")) return "Delvis / ikke komplett";
  return "Påbegynt";
}

function formatAnswer(entry) {
  const answer = state.answers[entry.id] || {};
  const parts = [];
  if (answer.neuro) {
    const neuroParts = NEURO_SCREENING_FIELDS
      .map(([key, label]) => `${label.toLowerCase()}: ${answer.neuro[key] || "ikke utfylt"}`)
      .join(", ");
    parts.push(neuroParts);
  } else if (answer.choice) {
    parts.push(answer.choice);
  }
  if (answer.text) parts.push(answer.text);
  return parts.join(". ") || "ikke utfylt";
}

function markAssessmentStale() {
  if (!state.assessment) return;
  state.assessmentStale = true;
  updateAssessmentControls();
}

function setAssessmentHidden(hidden) {
  state.assessmentHidden = hidden;
  updateAssessmentControls();
  updateStickyActionBar();
}

function updateAssessmentControls() {
  const hasAssessment = Boolean(state.assessment);
  els.assessmentFreshness.hidden = !state.assessmentStale;
  els.hideAssessment.hidden = !hasAssessment || state.assessmentHidden;
  els.showAssessment.hidden = !hasAssessment || !state.assessmentHidden;
  els.risk.hidden = hasAssessment && state.assessmentHidden;
  if (hasAssessment && state.assessmentHidden) {
    els.summaryPanel.classList.add("assessment-collapsed");
  } else {
    els.summaryPanel.classList.remove("assessment-collapsed");
  }
}

function sheetItems() {
  return state.sheet ? [...state.sheet.questions, ...state.sheet.examinations] : [];
}

function activeItem() {
  return sheetItems()[state.activeItemIndex] || null;
}

function itemIndex(id) {
  return sheetItems().findIndex((entry) => entry.id === id);
}

function clampActiveItemIndex() {
  const total = sheetItems().length;
  if (total === 0) {
    state.activeItemIndex = 0;
    return;
  }
  state.activeItemIndex = Math.min(Math.max(state.activeItemIndex, 0), total - 1);
}

function setActiveItemById(id, rerender = true) {
  const index = itemIndex(id);
  if (index < 0) return;
  state.activeItemIndex = index;
  updateFlowControls();
  if (rerender && state.viewMode === "focus") renderSheet();
}

function setViewMode(mode) {
  state.viewMode = mode;
  clampActiveItemIndex();
  renderSheet();
  if (mode === "focus") focusActiveItemControl();
}

function moveActiveItem(direction) {
  const total = sheetItems().length;
  if (!total) return;
  state.activeItemIndex = Math.min(Math.max(state.activeItemIndex + direction, 0), total - 1);
  renderSheet();
  focusActiveItemControl();
}

function updateFlowControls() {
  const total = sheetItems().length;
  els.flowControls.hidden = total === 0;
  els.showAllMode.classList.toggle("active", state.viewMode === "all");
  els.focusMode.classList.toggle("active", state.viewMode === "focus");
  els.activeItemStatus.textContent = total ? `${state.activeItemIndex + 1} / ${total}` : "0 / 0";
  els.previousItem.disabled = state.activeItemIndex <= 0;
  els.nextItem.disabled = total === 0 || state.activeItemIndex >= total - 1;
}

function updatePostSheetActions() {
  if (!state.sheet) {
    els.postSheetActions.hidden = true;
    return;
  }
  const complete = isSheetComplete();
  els.postSheetActions.hidden = !complete;
  els.reviewBanner.hidden = !complete;
  if (complete) updateReviewUi();
}

function activeCardElement(id) {
  return [...document.querySelectorAll(".item-card")].find((card) => card.dataset.id === id) || null;
}

function activeShortcutRow(scope) {
  if (!scope) return null;
  const focusedRow = document.activeElement?.closest?.(".button-row");
  if (focusedRow && scope.contains(focusedRow)) return focusedRow;
  return scope.querySelector(".button-row");
}

function focusNextNeuroRow(button) {
  const rows = [...button.closest(".neuro-grid")?.querySelectorAll(".button-row") || []];
  const currentRow = button.closest(".button-row");
  const nextRow = rows[rows.indexOf(currentRow) + 1];
  if (!nextRow) return false;
  const nextButton = nextRow.querySelector(".answer-button");
  if (!nextButton) return false;
  setTimeout(() => nextButton.focus(), 80);
  return true;
}

function focusActiveItemControl() {
  const active = activeItem();
  if (!active) return;
  setTimeout(() => {
    const scope = activeCardElement(active.id);
    const control = scope?.querySelector(".answer-button, .free-text");
    control?.focus({ preventScroll: true });
  }, 0);
}

function updateStickyPosition() {
  state.nearTop = window.scrollY < STICKY_TOP_HIDE_OFFSET;
  updateStickyActionBar();
}

function updateStickyActionBar() {
  const { completed } = getCompletion();
  const shouldShow = state.sheet && completed > 0 && !state.nearTop && !state.stickyDismissed;

  els.stickyBar.classList.toggle("visible", shouldShow);
  els.stickyBar.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  document.body.classList.toggle("has-sticky-action-bar", shouldShow);
  els.stickyViewAssessment.hidden = !state.assessment || !state.assessmentHidden;
}

function updateFlowHint() {
  if (!els.flowHint) return;

  const dismissed = localStorage.getItem(FLOW_HINT_DISMISSED_KEY) === "true";
  const hasCachedSheet = Boolean(localStorage.getItem(cacheKey()));
  const shouldShow = !dismissed && !state.sheet && !hasCachedSheet;

  els.flowHint.hidden = !shouldShow;
}

function scrollToAssessment() {
  els.summaryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  els.assess.focus({ preventScroll: true });
}

function patientContextText() {
  const patient = els.patientId.value.trim() ? `${els.patientId.value.trim()} · ` : "";
  const firstEpisode = els.firstEpisode.value === "ja" ? "første episode" : els.firstEpisode.value === "nei" ? "kjent/tilbakevendende" : "uklart førstegangsforløp";
  return `${patient}${els.sex.value}, ${els.age.value || "ukjent alder"} år · ${els.sheetType.value} · ${firstEpisode} · ${els.timeBudget.value} min`;
}

function setupSummaryText() {
  return `${patientContextText()} · ${normalizeTopic(els.caseInput.value)}`;
}

function setSetupCollapsed(collapsed) {
  state.setupCollapsed = collapsed;
  els.setupPanel.classList.toggle("collapsed", collapsed);
  els.setupSummary.hidden = !collapsed;
  els.setupSummaryText.textContent = setupSummaryText();
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
