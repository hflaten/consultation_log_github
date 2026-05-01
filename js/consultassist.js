(function exposeConsultAssist(root) {
  const URGENCY = {
    sameDay: {
      id: "same_day",
      label: "må vurderes raskt / samme dag"
    },
    canWait: {
      id: "can_wait",
      label: "kan vente med sikkerhetsnett"
    },
    unclear: {
      id: "unclear",
      label: "uklart - trenger mer informasjon"
    }
  };

  const DISCLAIMER = "Dette er beslutningsstøtte for kliniker og ikke en endelig diagnose. Legen må kvalitetssikre vurdering, hastegrad og plan.";

  const CRITICAL_ENTRY_PATTERN = /røde? flagg|nevrolog|dobbeltsyn|tale|pares|kraft|sensibilitet|ataksi|gange|kardio|bryst|synkope|besvim|palpitas|arytmi|tungpust|allmenntilstand|vital|bt|blodtrykk|puls|spo2|respirasjon|hodepine|nakkestiv|hørselstap|feber|infeksjon|dehydrer|fall|gravid|immunsuppres|ekg|funksjon|alvorlig|akutt|risiko/i;
  const UNSURE_PATTERN = /usikker|usikkert|uklart|ukjent|ikke utført|ikke vurdert|ikke avklart|mangler/i;
  const POSITIVE_RED_FLAG_CHOICE_PATTERN = /^(ja|avvik|patologisk|positiv|alvorlig|ustabil|påvirket|synkope|nær besvimelse|hørselstap|infeksjon|mulig relevant)$/i;
  const NEGATION_PATTERN = /\b(ingen|ikke|uten|nekter|benekter|avkrefter|nei)\b/i;

  const RED_FLAG_PATTERNS = [
    { pattern: /nevrolog|dobbeltsyn|talevansk|pares|lammelse|kraftsvikt|sensibilitetstap|ataksi|ustø gange/i, label: "Nevrologiske utfall eller sentrale symptomer" },
    { pattern: /synkope|besvim|nær besvimelse/i, label: "Synkope eller nær-synkope" },
    { pattern: /brystsmer|tungpust|palpitas|arytmi|iskemi/i, label: "Kardiopulmonale alarmsymptomer" },
    { pattern: /ny.*hodepine|kraftig.*hodepine|nakkestiv/i, label: "Ny kraftig hodepine eller nakkestivhet" },
    { pattern: /hørselstap|akutt hørsel/i, label: "Nytt hørselstap" },
    { pattern: /ustabil|påvirket allmenntilstand|sirkulatorisk|dehydrer|vedvarende oppkast/i, label: "Påvirket allmenntilstand eller sirkulasjon" },
    { pattern: /avvik|patologisk|positiv|feber|infeksjonstegn/i, label: "Avvikende undersøkelse eller infeksjonstegn" }
  ];

  function generateConsultAssistAssessment(input) {
    const sheet = normalizeSheet(input?.sheet);
    const answers = input?.answers || {};
    const allEntries = [...sheet.questions, ...sheet.examinations];
    const summaryEntries = allEntries.map((entry) => summarizeEntry(entry, answers[entry.id]));
    const missingAnswers = summaryEntries.filter((entry) => !entry.isAnswered);
    const missingCriticalAnswers = summaryEntries.filter((entry) => entry.isCritical && !entry.isAnswered);
    const redFlagHits = collectRedFlagHits(summaryEntries);
    const uncertainAnswers = summaryEntries.filter((entry) => entry.isAnswered && entry.isUnclear);
    const completion = {
      completed: summaryEntries.filter((entry) => entry.isAnswered).length,
      total: summaryEntries.length,
      percent: summaryEntries.length ? Math.round((summaryEntries.filter((entry) => entry.isAnswered).length / summaryEntries.length) * 100) : 0,
      isComplete: summaryEntries.length > 0 && missingAnswers.length === 0
    };
    const urgency = chooseUrgency({ redFlagHits, missingCriticalAnswers, missingAnswers, uncertainAnswers });
    const categories = buildCategories({ urgency, redFlagHits, missingCriticalAnswers, missingAnswers, uncertainAnswers });
    const followUpPlan = buildFollowUpPlan(urgency, sheet, redFlagHits, missingCriticalAnswers, uncertainAnswers);

    return {
      disclaimer: DISCLAIMER,
      urgency,
      categories,
      completion,
      redFlags: {
        configured: sheet.redFlags,
        hits: redFlagHits
      },
      missingCriticalAnswers,
      missingAnswers,
      uncertainAnswers,
      summaryEntries,
      followUpPlan,
      canGenerateFinalReport: completion.isComplete && missingCriticalAnswers.length === 0,
      generatedAt: new Date().toISOString()
    };
  }

  function normalizeSheet(sheet) {
    return {
      title: sheet?.title || "Konsultasjonsark",
      goal: sheet?.goal || "",
      redFlags: Array.isArray(sheet?.redFlags) ? sheet.redFlags : [],
      questions: Array.isArray(sheet?.questions) ? sheet.questions : [],
      examinations: Array.isArray(sheet?.examinations) ? sheet.examinations : [],
      followUp: Array.isArray(sheet?.followUp) ? sheet.followUp : []
    };
  }

  function summarizeEntry(entry, answer = {}) {
    const choice = typeof answer.choice === "string" ? answer.choice.trim() : "";
    const text = typeof answer.text === "string" ? answer.text.trim() : "";
    const answerText = [choice, text].filter(Boolean).join(". ");
    const entryText = [entry.label, entry.why, entry.placeholder].filter(Boolean).join(" ");
    const isCritical = CRITICAL_ENTRY_PATTERN.test(entryText);
    const isUnclear = UNSURE_PATTERN.test(answerText);

    return {
      id: entry.id,
      label: entry.label || entry.id,
      why: entry.why || "",
      type: String(entry.id || "").startsWith("e") ? "examination" : "question",
      choice,
      text,
      answerText,
      isAnswered: Boolean(choice || text),
      isCritical,
      isUnclear,
      redFlagMatches: findRedFlagMatches({ answerText, choice, entryText, isCritical })
    };
  }

  function findRedFlagMatches({ answerText, choice, entryText, isCritical }) {
    if (!answerText) return [];

    const matches = [];
    for (const redFlag of RED_FLAG_PATTERNS) {
      const match = answerText.match(redFlag.pattern);
      if (match && !isNegated(answerText, match.index || 0)) {
        matches.push(redFlag.label);
      }
    }

    if (isCritical && POSITIVE_RED_FLAG_CHOICE_PATTERN.test(choice) && !UNSURE_PATTERN.test(choice)) {
      matches.push(`Avvikende svar på kritisk punkt: ${compact(entryText)}`);
    }

    return [...new Set(matches)];
  }

  function isNegated(text, matchIndex) {
    const previousPunctuation = Math.max(
      text.lastIndexOf(".", matchIndex),
      text.lastIndexOf(";", matchIndex),
      text.lastIndexOf("\n", matchIndex)
    );
    const contextStart = Math.max(previousPunctuation + 1, matchIndex - 90);
    const context = text.slice(contextStart, matchIndex);
    if (/\b(men|likevel|derimot)\b/i.test(context)) return false;
    return NEGATION_PATTERN.test(context);
  }

  function collectRedFlagHits(summaryEntries) {
    return summaryEntries
      .filter((entry) => entry.redFlagMatches.length > 0)
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        answer: entry.answerText,
        reasons: entry.redFlagMatches
      }));
  }

  function chooseUrgency({ redFlagHits, missingCriticalAnswers, missingAnswers, uncertainAnswers }) {
    if (missingCriticalAnswers.length > 0) return URGENCY.unclear;
    if (redFlagHits.length > 0) return URGENCY.sameDay;
    if (missingAnswers.length > 0 || uncertainAnswers.length > 0) return URGENCY.unclear;
    return URGENCY.canWait;
  }

  function buildCategories({ urgency, redFlagHits, missingCriticalAnswers, missingAnswers, uncertainAnswers }) {
    return [
      {
        ...URGENCY.sameDay,
        active: urgency.id === URGENCY.sameDay.id,
        evidence: redFlagHits.map((hit) => `${hit.label}: ${hit.answer}`)
      },
      {
        ...URGENCY.canWait,
        active: urgency.id === URGENCY.canWait.id,
        evidence: urgency.id === URGENCY.canWait.id
          ? ["Alle kritiske punkter er besvart uten registrerte røde flagg i arket."]
          : []
      },
      {
        ...URGENCY.unclear,
        active: urgency.id === URGENCY.unclear.id,
        evidence: [
          ...missingCriticalAnswers.map((entry) => `Mangler kritisk svar: ${entry.label}`),
          ...uncertainAnswers.map((entry) => `Uklart svar: ${entry.label} (${entry.answerText})`),
          ...(missingAnswers.length > missingCriticalAnswers.length ? [`${missingAnswers.length} punkt(er) mangler før full vurdering.`] : [])
        ]
      }
    ];
  }

  function buildFollowUpPlan(urgency, sheet, redFlagHits, missingCriticalAnswers, uncertainAnswers) {
    if (urgency.id === URGENCY.sameDay.id) {
      return [
        "Vurder pasienten raskt / samme dag ut fra klinisk helhet, vitale parametre og relevante røde flagg.",
        "Dokumenter hvilke røde flagg som er til stede eller avkreftet, og begrunn hastegrad.",
        "Konferer med legevakt/akuttmottak eller legg inn ved nevrologiske utfall, ustabil pasient, synkope med alarmsymptomer, brystsmerter/tungpust eller andre alvorlige funn.",
        "Ikke erstatt akutt vurdering med ordinær kontroll dersom røde flagg vedvarer."
      ];
    }

    if (urgency.id === URGENCY.unclear.id) {
      return [
        "Avklar manglende kritiske svar før endelig rapport genereres.",
        ...missingCriticalAnswers.slice(0, 4).map((entry) => `Innhent kritisk punkt: ${entry.label}.`),
        ...uncertainAnswers.slice(0, 3).map((entry) => `Presiser uklart svar: ${entry.label}.`),
        "Gi midlertidig sikkerhetsnett: pasienten skal ta kontakt raskt ved forverring, nye nevrologiske symptomer, synkope, brystsmerter, tungpust, feber/påvirket allmenntilstand eller andre alarmsymptomer."
      ];
    }

    return [
      "Dokumenter nåværende symptomer/status: debut, varighet, frekvens, funksjon, relevante negative røde flagg og undersøkelsesfunn.",
      "Be pasienten registrere/dagbokføre episoder: tidspunkt, varighet, utløsere, stillingsendring, væske/matinntak, søvn/stress, legemidler/rusmidler, puls ved palpitasjoner og ledsagende symptomer.",
      "Gi klare retur-/kontaktregler: ta kontakt raskt eller legevakt ved forverring, synkope/nær-synkope, brystsmerter, tungpust, nye nevrologiske symptomer, ny kraftig hodepine, hørselstap, feber eller påvirket allmenntilstand.",
      suggestedFollowUpInterval(sheet)
    ];
  }

  function suggestedFollowUpInterval(sheet) {
    const sourceText = [...sheet.followUp, sheet.goal, sheet.title].join(" ").toLowerCase();
    if (/kontroll|oppfølging|vedvar|langvar|uklar|dagbok|registr/.test(sourceText)) {
      return "Avtal kontroll hos fastlege etter registreringsperiode, typisk innen 1-4 uker, eller tidligere ved forverring.";
    }
    return "Vurder avtalt kontroll dersom symptomene vedvarer, endrer karakter eller pasienten trenger gjennomgang av registreringene.";
  }

  function compact(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 90);
  }

  const api = {
    generateConsultAssistAssessment,
    CONSULTASSIST_URGENCY: URGENCY
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.generateConsultAssistAssessment = generateConsultAssistAssessment;
  root.CONSULTASSIST_URGENCY = URGENCY;
})(typeof globalThis !== "undefined" ? globalThis : window);
