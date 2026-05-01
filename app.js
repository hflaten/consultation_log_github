const SHEET_VERSION = "v2";
const PROMPT_VERSION = "v2";
const SCHEMA_VERSION = "v2";
const SOURCE_VERSION = "openai:gpt-5.2";
const REVIEWER_STORAGE_KEY = "consultassist-reviewer-name";
const FLOW_HINT_DISMISSED_KEY = "consultassist-flow-hint-dismissed";
const SUPABASE_PROJECT_URL = "https://tnklkqcmzxwnvhnbgsay.supabase.co";
const SUPABASE_STORAGE_BUCKETS = {
  sheetTemplates: "consultassist-sheet-templates",
  reportExports: "consultassist-report-exports"
};

const defaultPrompt = `Du er en klinisk assistent for en fastlege i Norge. Lag et triage-først konsultasjonsark for en 15-minutters første kontakt basert på pasientpresentasjon og klinisk mål. Listen skal hjelpe legen med å avklare alvorlighetsgrad, røde flagg, differensialdiagnoser og plan for videre utredning/oppfølging uten å bli en bred, uttømmende utredning.

Input:
- Pasient: alder, kjønn, relevant kontekst
- Presenterende problemstilling: fri tekst
- Ønsket arktype: minimumsliste for konsultasjon
- Første episode: ja/nei
- Språk: norsk bokmål
- Klinisk ramme: fastlegekontor i Norge

Output som JSON:
- title
- goal
- redFlags: korte punkter
- questions: må-spørres liste med { id, label, why, buttons, placeholder }
- examinations: må-undersøkes liste med { id, label, why, buttons, placeholder }
- optionalItems: valgfritt/kontekstavhengig liste med { id, label, why, buttons, placeholder }
- followUp: anbefalte neste steg

Krav:
- Første episode skal gi en minimumsliste for 15 minutter, ikke en bred utredningsliste.
- Del tydelig mellom må-spørres, må-undersøkes og valgfritt/kontekstavhengig.
- Bruk korte, praktiske formuleringer egnet under konsultasjon.
- Hvert punkt skal ha relevante svarknapper og et lite fritekstfelt.
- Ikke gi en endelig diagnose. Støtt legens vurdering.
- Marker røde flagg og når akutt vurdering bør vurderes.`;

const dizzinessTemplate = {
  title: "Svimmelhet - minimumsliste",
  goal: "Avklare alvorlighetsgrad, røde flagg, sannsynlig årsak og behov for videre utredning eller oppfølging.",
  firstEpisodeFocus: "Minimumsliste for 15-minutters første kontakt med rask avklaring av alvorlighet.",
  redFlags: [
    "Akutt nevrologisk utfall, ny kraftig hodepine eller synkope",
    "Brystsmerter, tungpust, palpitasjoner eller arytmimistanke",
    "Vedvarende oppkast, dehydrering eller falltendens",
    "Ny hørselstap, alvorlig infeksjonstegn eller nakkestivhet"
  ],
  questions: [
    item("q1", "Debut og forløp", "Skiller akutt alvorlig sykdom fra benign episodisk svimmelhet.", ["Akutt", "Gradvis", "Anfallsvis", "Konstant"], "Når startet det, og hvordan har det utviklet seg?"),
    item("q2", "Karakter", "Vertigo, presynkope og ustøhet peker mot ulike videre spor.", ["Rotatorisk", "Nær besvimelse", "Ustøhet", "Uklart"], "Pasientens egne ord."),
    item("q3", "Utløsende faktorer", "Stillingsutløst svimmelhet kan passe med BPPV.", ["Hodebevegelse", "Reise seg", "Anstrengelse", "Ingen tydelig"], "Hva utløser eller lindrer plagene?"),
    item("q4", "Nevrologiske symptomer", "Røde flagg for sentral årsak må avklares tidlig.", ["Nei", "Ja", "Usikkert"], "Dobbeltsyn, talevansker, nummenhet, pareser, ataksi."),
    item("q5", "Kardiopulmonale symptomer", "Kan peke mot arytmi, iskemi eller annen akutt somatikk.", ["Nei", "Ja", "Usikkert"], "Brystsmerter, palpitasjoner, tungpust, synkope."),
    item("q6", "Øre-/infeksjonssymptomer", "Hørselstap, tinnitus og infeksjon påvirker vurdering og tiltak.", ["Ingen", "Tinnitus", "Hørselstap", "Infeksjon"], "Øresmerter, feber, nylig luftveisinfeksjon."),
    item("q7", "Legemidler og rusmidler", "Bivirkninger og blodtrykksfall er vanlige reversible årsaker.", ["Ingen relevante", "Mulig relevant", "Usikkert"], "Nye medisiner, antihypertensiva, alkohol, andre rusmidler.")
  ],
  examinations: [
    item("e1", "Allmenntilstand og vitale parametre", "Fanger akutt sykdom og sirkulatorisk påvirkning.", ["Upåfallende", "Avvik", "Ikke utført"], "BT, puls, temp, SpO2, respirasjon."),
    item("e2", "Ortostatisk blodtrykk", "Vurderer ortostatisk hypotensjon.", ["Normal", "Patologisk", "Ikke utført"], "Liggende/stående BT og puls."),
    item("e3", "Nevrologisk undersøkelse", "Avklarer sentrale tegn.", ["Normal", "Avvik", "Ikke utført"], "Kranialnerver, kraft, sensibilitet, koordinasjon, gange."),
    item("e4", "Ørestatus og nystagmus", "Støtter perifer vestibulær vurdering.", ["Normal", "Avvik", "Ikke utført"], "Otoskopi, spontan-/blikkretningsnystagmus."),
    item("e5", "Dix-Hallpike / posisjonstester", "Relevant ved stillingsutløst vertigo.", ["Negativ", "Positiv", "Ikke indisert/utført"], "Side, nystagmus, symptomreproduksjon."),
    item("e6", "EKG ved indikasjon", "Aktuelt ved synkope, palpitasjoner eller risikoprofil.", ["Normal", "Avvik", "Ikke indisert/utført"], "Rytme, frekvens, ledningsforstyrrelser.")
  ],
  optionalItems: [
    item("o1", "Supplerende tester", "Tas bare ved funn eller risikoprofil som tilsier mer utredning i første kontakt.", ["Ikke aktuelt nå", "Planlagt", "Utført"], "Blodprøver, glukose, CRP eller annet."),
    item("o2", "Arbeid, bilkjøring og fallrisiko", "Kontekst påvirker sikkerhetsnett og praktiske råd.", ["Ikke problem", "Relevant", "Usikkert"], "Skriv konkrete råd eller begrensninger.")
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
  firstEpisodeFocus: "Minimumsliste for 15-minutters første kontakt med prioritering av røde flagg og målrettede funn.",
  redFlags: [
    "Akutt funksjonstap eller rask forverring",
    "Sterke smerter, påvirket allmenntilstand eller sirkulatorisk påvirkning",
    "Symptomer som ikke passer med benign forklaring"
  ],
  questions: [
    item("q1", "Debut og varighet", "Tidsforløpet styrer hastegrad og differensialdiagnoser.", ["Akutt", "Subakutt", "Langvarig", "Tilbakevendende"], "Når startet plagene?"),
    item("q2", "Alvorlighetsgrad og funksjon", "Avklarer hvor mye plagene påvirker pasienten.", ["Lett", "Moderat", "Alvorlig", "Varierende"], "Arbeid, søvn, aktivitet, egenomsorg."),
    item("q3", "Ledsagende symptomer", "Finner mønstre og røde flagg.", ["Ingen", "Noen", "Flere", "Usikkert"], "Feber, smerter, vekttap, nevrologi, annet."),
    item("q4", "Tidligere sykdom og risiko", "Setter symptomet i klinisk kontekst.", ["Ingen relevant", "Relevant", "Usikkert"], "Komorbiditet, familiehistorie, graviditet, immunsuppresjon."),
    item("q5", "Legemidler og tiltak forsøkt", "Avklarer bivirkninger og effekt av egenbehandling.", ["Ingen", "Noe effekt", "Ingen effekt", "Bivirkning"], "Medikamenter, naturmidler, egenbehandling.")
  ],
  examinations: [
    item("e1", "Allmenntilstand og vitale parametre", "Grunnlag for hastegrad.", ["Normal", "Avvik", "Ikke utført"], "BT, puls, temp, SpO2 etter behov."),
    item("e2", "Målrettet klinisk undersøkelse", "Knytter funn til problemstillingen.", ["Normal", "Avvik", "Ikke utført"], "Beskriv relevante funn."),
    item("e3", "Supplerende tester ved indikasjon", "Støtter beslutning om videre plan.", ["Ikke indisert", "Utført normal", "Utført avvik"], "Urin, CRP, EKG, blodprøver eller annet.")
  ],
  optionalItems: [
    item("o1", "Pasientens mål og bekymring", "Nyttig når tid og problemstilling tillater det.", ["Avklart", "Ikke avklart", "Ikke aktuelt"], "Hva er pasienten mest bekymret for?"),
    item("o2", "Praktiske rammer for oppfølging", "Kontekst kan endre plan og sikkerhetsnett.", ["Enkelt", "Utfordrende", "Usikkert"], "Arbeid, omsorgsansvar, reise, tilgjengelighet.")
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
  stickyDismissed: false,
  nearTop: true
};

const STICKY_TOP_HIDE_OFFSET = 160;

const els = {
  age: document.querySelector("#ageInput"),
  sex: document.querySelector("#sexInput"),
  sheetType: document.querySelector("#sheetType"),
  firstEpisode: document.querySelectorAll('input[name="firstEpisode"]'),
  caseInput: document.querySelector("#caseInput"),
  prompt: document.querySelector("#promptInput"),
  generate: document.querySelector("#generateSheet"),
  example: document.querySelector("#loadExample"),
  clear: document.querySelector("#clearSession"),
  flowHint: document.querySelector("#flowHint"),
  dismissFlowHint: document.querySelector("#dismissFlowHint"),
  cacheStatus: document.querySelector("#cacheStatus"),
  completionStatus: document.querySelector("#completionStatus"),
  reviewStatus: document.querySelector("#reviewStatus"),
  sheetSubtitle: document.querySelector("#sheetSubtitle"),
  reviewBanner: document.querySelector("#reviewBanner"),
  reviewLabel: document.querySelector("#reviewLabel"),
  reviewMeta: document.querySelector("#reviewMeta"),
  reviewTemplate: document.querySelector("#reviewTemplate"),
  sheetContainer: document.querySelector("#sheetContainer"),
  summaryPanel: document.querySelector(".summary-panel"),
  assess: document.querySelector("#assessButton"),
  risk: document.querySelector("#riskPanel"),
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

els.prompt.value = defaultPrompt;

els.generate.addEventListener("click", generateSheet);
els.example.addEventListener("click", () => {
  els.age.value = "44";
  els.sex.value = "mann";
  els.sheetType.value = "minimumsliste";
  setFirstEpisode(true);
  els.caseInput.value = "Mann 44 kommer til fastlege pga svimmelhet. Sett opp en minimumsliste over spørsmål og undersøkelser jeg kan fylle svaret rett inn i. Målet er å avklare alvorlighetsgrad av tilstanden samt planlegge videre utredning/oppfølging.";
  updateFlowHint();
});
els.clear.addEventListener("click", clearAnswers);
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
[els.age, els.sex, els.sheetType, els.caseInput].forEach((input) => {
  input.addEventListener("input", updateFlowHint);
  input.addEventListener("change", updateFlowHint);
});
els.firstEpisode.forEach((input) => input.addEventListener("change", updateFlowHint));
window.addEventListener("scroll", updateStickyPosition, { passive: true });
window.addEventListener("resize", updateStickyPosition);
updateFlowHint();
updateStickyPosition();

function item(id, label, why, buttons, placeholder) {
  return { id, label, why, buttons, placeholder };
}

function normalizeTopic(text) {
  const lower = text.toLowerCase();
  if (lower.includes("svimmel") || lower.includes("vertigo")) return "svimmelhet";
  return lower.split(/[.,\n]/)[0].replace(/[^a-zæøå0-9 ]/gi, "").trim().slice(0, 60) || "generelt";
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
    firstEpisodeValue(),
    els.sheetType.value,
    "nb-no",
    "fastlege"
  ].join(":");
}

function sheetSubtitle(sheet) {
  const episodeLabel = sheet.firstEpisode ? "første episode" : "tilbakevendende episode";
  return `${sheet.title} · ${episodeLabel} · ${sheet.goal}`;
}

async function generateSheet() {
  const key = cacheKey();
  const cached = localStorage.getItem(key);
  if (cached) {
    state.sheet = JSON.parse(cached);
    normalizeSheetForUi(state.sheet);
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
      normalizeSheetForUi(state.sheet);
      state.sheet.cacheKey = key;
      state.sheet.createdAt = new Date().toISOString();
      state.sheet.source = "local_fallback";
      state.sheet.firstEpisode = firstEpisodeValue() === "first";
      state.sheet.review = buildDraftReviewMetadata(sourceBasis(), "local_fallback");
      localStorage.setItem(key, JSON.stringify(state.sheet));
      els.cacheStatus.textContent = "AI utilgjengelig - lokal fallback brukt";
    } finally {
      els.generate.disabled = false;
    }
  }
  state.answers = {};
  state.assessment = null;
  state.stickyDismissed = false;
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
      firstEpisode: firstEpisodeValue(),
      presentation: els.caseInput.value,
      prompt: els.prompt.value,
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
  normalizeSheetForUi(data.sheet);
  els.cacheStatus.textContent = cacheStatusForSheet(data.sheet, data.cacheHit ? "Supabase cache" : "Supabase cache");
  return data.sheet;
}

function renderSheet() {
  const sheet = state.sheet;
  normalizeSheetForUi(sheet);
  els.sheetSubtitle.textContent = sheetSubtitle(sheet);
  updateReviewUi();
  els.sheetContainer.className = "";
  els.sheetContainer.innerHTML = [
    renderTriageIntro(sheet),
    renderSection("Må spørres", sheet.questions, "must-ask"),
    renderSection("Må undersøkes", sheet.examinations, "must-do"),
    renderSection("Valgfritt / kontekstavhengig", sheet.optionalItems, "optional")
  ].join("");

  document.querySelectorAll(".answer-button").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      state.answers[id] = state.answers[id] || {};
      state.answers[id].choice = button.dataset.value;
      document.querySelectorAll(`.answer-button[data-id="${id}"]`).forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
      });
      updateCompletion();
    });
  });

  document.querySelectorAll(".free-text").forEach((input) => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      state.answers[id] = state.answers[id] || {};
      state.answers[id].text = input.value.trim();
      updateCompletion();
    });
  });
}

async function approveTemplate() {
  if (!state.sheet) return;

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
  els.reviewMeta.textContent = reviewSummary(review);
  els.reviewTemplate.hidden = isReviewed;
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
    promptHash: stableHash(els.prompt.value),
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    sourceVersion: SOURCE_VERSION,
    templateVersion: SHEET_VERSION,
    firstEpisode: firstEpisodeValue()
  };
}

function isCurrentSourceBasis(existingBasis, currentBasis) {
  if (!existingBasis || !currentBasis) return false;
  return ["promptHash", "promptVersion", "schemaVersion", "sourceVersion", "templateVersion", "firstEpisode"]
    .every((key) => existingBasis[key] === currentBasis[key]);
}

function stableHash(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function renderTriageIntro(sheet) {
  const label = sheet.firstEpisode ? "Første episode / første gang" : "Tilbakevendende episode";
  const focus = sheet.firstEpisode
    ? sheet.firstEpisodeFocus
    : "Bruk minimumslisten raskt, og sammenlign med tidligere episoder der det er relevant.";
  return `<div class="triage-intro">
    <span>${escapeHtml(label)}</span>
    <strong>15-minutters triagefokus</strong>
    <p>${escapeHtml(focus)}</p>
  </div>`;
}

function renderSection(title, items, type) {
  if (!items.length) return "";
  return `<div class="sheet-section ${type}">
    <h3>${escapeHtml(title)} <span>${items.length}</span></h3>
    ${items.map((entry) => renderItem(entry, type)).join("")}
  </div>`;
}

function renderItem(entry, type) {
  return `<article class="item-card ${type}">
    <div class="item-title">
      <strong>${escapeHtml(entry.label)}</strong>
      <span>${escapeHtml(entry.why)}</span>
    </div>
    <div class="button-row">
      ${entry.buttons.map((button) => `<button class="answer-button" type="button" data-id="${entry.id}" data-value="${escapeHtml(button)}">${escapeHtml(button)}</button>`).join("")}
    </div>
    <input class="free-text" data-id="${entry.id}" placeholder="${escapeHtml(entry.placeholder)}">
  </article>`;
}

function updateCompletion() {
  if (!state.sheet) {
    els.completionStatus.textContent = "0% utfylt";
    els.assess.disabled = true;
    els.assess.hidden = true;
    els.stickyCount.textContent = "0 / 0 punkter fylt";
    els.stickyPercent.textContent = "0% utfylt";
    els.stickyAssess.disabled = true;
    els.stickyAssess.hidden = true;
    updateStickyActionBar();
    return;
  }
  const { completed, total, percent } = getCompletion();
  const hasStartedAnswers = completed > 0;
  els.completionStatus.textContent = `${percent}% utfylt`;
  els.assess.hidden = !hasStartedAnswers;
  els.assess.disabled = !hasStartedAnswers;
  els.stickyCount.textContent = `${completed} / ${total} punkter fylt`;
  els.stickyPercent.textContent = `${percent}% utfylt`;
  els.stickyAssess.hidden = !hasStartedAnswers;
  els.stickyAssess.disabled = els.assess.disabled;
  updateStickyActionBar();
}

function assess() {
  if (!state.sheet || els.assess.disabled) return;
  const values = Object.values(state.answers).map((answer) => `${answer.choice || ""} ${answer.text || ""}`.toLowerCase());
  const redFlagHits = values.filter((value) => /ja|avvik|synkope|bryst|pares|dobbeltsyn|tale|hodepine|hørselstap|patologisk/.test(value));
  const risk = redFlagHits.length >= 2 ? "high" : redFlagHits.length === 1 ? "medium" : "low";
  const title = risk === "high" ? "Høyere risiko / vurder akutt tiltak" : risk === "medium" ? "Moderat risiko / målrettet oppfølging" : "Lavere risiko ut fra utfylte svar";

  state.assessment = { risk, title };
  els.risk.className = `risk-panel ${risk}`;
  els.risk.innerHTML = `<strong>${title}</strong><br>${riskText(risk)}<br><br><strong>Røde flagg å kontrollere:</strong><ul>${state.sheet.redFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}</ul>`;
  els.report.value = buildReport();
  els.copy.disabled = false;
  els.pdf.disabled = false;
  updateStickyActionBar();
  scrollToAssessment();
}

function riskText(risk) {
  if (risk === "high") return "Funn eller svar kan passe med røde flagg. Legen bør vurdere hastegrad, konferering eller innleggelse ut fra klinisk helhet.";
  if (risk === "medium") return "Noen usikre eller avvikende svar foreligger. Vurder målrettet undersøkelse, supplerende tester og tydelig sikkerhetsnett.";
  return "Ingen tydelige røde flagg er registrert i utfylt ark. Fortsatt klinisk skjønn og sikkerhetsnett anbefales.";
}

function buildReport() {
  const questionEntries = formatReportEntries(state.sheet.questions);
  const examinationEntries = formatReportEntries(state.sheet.examinations);
  const optionalEntries = formatReportEntries(state.sheet.optionalItems.filter((entry) => {
    const answer = state.answers[entry.id];
    return answer && (answer.choice || answer.text);
  }));

  return `Journalnotat - ${state.sheet.title}

Problemstilling:
${els.caseInput.value.trim()}

Episode:
${state.sheet.firstEpisode ? "Første episode / første gang dette skjer med pasienten." : "Tilbakevendende episode / kjent fra tidligere."}

Anamnese - må spørres:
${questionEntries}

Undersøkelse - må gjøres:
${examinationEntries}
${optionalEntries ? `\nValgfritt / kontekstavhengig utfylt:\n${optionalEntries}\n` : ""}

Vurdering:
${state.assessment.title}. ${riskText(state.assessment.risk)}

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
  state.stickyDismissed = false;
  if (state.sheet) renderSheet();
  updateCompletion();
  resetReport();
}

function resetReport() {
  els.risk.className = "risk-panel muted";
  els.risk.textContent = state.sheet ? "Fyll ut noen svar i arket for å lage vurdering." : "Lag et konsultasjonsark først, fyll det ut, og hent deretter vurdering.";
  els.report.value = "";
  els.copy.disabled = true;
  els.pdf.disabled = true;
  updateStickyActionBar();
}

function getCompletion() {
  const allItems = state.sheet ? sheetItems(state.sheet) : [];
  const completed = allItems.filter((entry) => {
    const answer = state.answers[entry.id];
    return answer && (answer.choice || answer.text);
  }).length;

  return {
    completed,
    total: allItems.length,
    percent: allItems.length ? Math.round((completed / allItems.length) * 100) : 0
  };
}

function firstEpisodeValue() {
  const selected = Array.from(els.firstEpisode).find((input) => input.checked);
  return selected?.value === "no" ? "recurring" : "first";
}

function setFirstEpisode(isFirst) {
  els.firstEpisode.forEach((input) => {
    input.checked = isFirst ? input.value === "yes" : input.value === "no";
  });
}

function normalizeSheetForUi(sheet) {
  sheet.firstEpisode = sheet.firstEpisode ?? firstEpisodeValue() === "first";
  sheet.firstEpisodeFocus = sheet.firstEpisodeFocus || "Minimumsliste for 15-minutters første kontakt med rask avklaring av alvorlighet.";
  sheet.questions = Array.isArray(sheet.questions) ? sheet.questions : [];
  sheet.examinations = Array.isArray(sheet.examinations) ? sheet.examinations : [];
  sheet.optionalItems = Array.isArray(sheet.optionalItems) ? sheet.optionalItems : [];
  sheet.followUp = Array.isArray(sheet.followUp) ? sheet.followUp : [];
}

function sheetItems(sheet) {
  normalizeSheetForUi(sheet);
  return [...sheet.questions, ...sheet.examinations, ...sheet.optionalItems];
}

function formatReportEntries(items) {
  return items.map((entry) => {
    const answer = state.answers[entry.id] || {};
    return `- ${entry.label}: ${[answer.choice, answer.text].filter(Boolean).join(". ") || "ikke utfylt"}`;
  }).join("\n");
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
  els.stickyViewAssessment.hidden = !state.assessment;
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
