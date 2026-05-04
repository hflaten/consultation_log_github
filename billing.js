(function initBillingModule(globalScope) {
  const ABSENT_VALUES = new Set(["ikke_utfort", "ikke_gjort", "ikke_indisert"]);

  function normalizeToken(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/\+/g, " ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeQuestionKey(label) {
    return normalizeToken(label)
      .replace(/^ore_/, "ore")
      .replace(/_og_/g, "_")
      .replace(/_ved_indikasjon$/, "_ved_indikasjon");
  }

  function normalizeAnswerValue(value) {
    const normalized = normalizeToken(value);
    if (["ikke_utfort", "ikke_gjort", "ikke_indisert", "ikke_indisert_utfort"].includes(normalized)) return normalized;
    if (normalized === "patologisk") return "patologisk";
    if (normalized === "avvik") return "avvik";
    if (normalized === "normal") return "normal";
    if (normalized === "positiv") return "positiv";
    if (normalized === "negativ") return "negativ";
    if (normalized === "utfort" || normalized === "utført") return "utfort";
    return normalized;
  }

  function isAbsentAnswer(answerValue) {
    const normalized = normalizeAnswerValue(answerValue);
    return ABSENT_VALUES.has(normalized) || normalized === "ikke_indisert_utfort";
  }

  function resolveTriggersFromSheet(sheetAnswers, tariffData) {
    const triggers = new Set(["standard_consultation"]);
    const sourcesByTrigger = new Map([["standard_consultation", ["Basis: fysisk konsultasjon dagtid"]]]);
    const triggerMap = tariffData.sheet_question_to_trigger_map || {};

    Object.values(sheetAnswers || {}).forEach((answer) => {
      if (!answer || isAbsentAnswer(answer.answerValue)) return;
      const questionKey = normalizeQuestionKey(answer.questionLabel || answer.questionKey);
      const answerValue = normalizeAnswerValue(answer.answerValue);
      const lookupKey = `${questionKey}_${answerValue}`;
      const performedLookupKey = `${questionKey}_utfort`;
      const matched = triggerMap[lookupKey] || triggerMap[performedLookupKey] || [];
      matched.forEach((trigger) => {
        triggers.add(trigger);
        const sources = sourcesByTrigger.get(trigger) || [];
        sources.push(`${answer.questionLabel || questionKey} - ${answer.answerValue}`);
        sourcesByTrigger.set(trigger, sources);
      });
    });

    return { triggers, sourcesByTrigger };
  }

  function resolveCodesFromTriggers(triggers, tariffData) {
    const codes = new Set();
    const consultationMap = tariffData.consultation_trigger_map || {};
    triggers.forEach((trigger) => {
      (consultationMap[trigger] || []).forEach((code) => codes.add(code));
    });
    return codes;
  }

  function fetchTakster(codes, tariffData) {
    const byCode = new Map((tariffData.takster || []).map((takst) => [takst.code, takst]));
    return [...codes].map((code) => byCode.get(code)).filter(Boolean);
  }

  function validateCombinations(candidates) {
    let current = [...candidates];
    let changed = true;

    while (changed) {
      changed = false;
      const activeByCode = new Map(current.map((takst) => [takst.code, takst]));
      const removals = new Set();
      current.forEach((takst) => {
        (takst.invalid_combinations || []).forEach((code) => {
          const conflict = activeByCode.get(code);
          if (!conflict) return;
          const remove = takstPriority(takst) >= takstPriority(conflict) ? conflict : takst;
          removals.add(remove.code);
        });
      });
      if (removals.size > 0) {
        changed = true;
        current = current.filter((takst) => !removals.has(takst.code));
      }
    }

    return current;
  }

  function takstPriority(takst) {
    if (!takst) return 0;
    if (["2ad", "2ak", "2as", "2at", "2av", "2afs", "2aft", "2afv"].includes(takst.code)) return 100;
    if (["110", "121a", "129g", "215"].includes(takst.code)) return 90;
    if (/^10[a-d]$/.test(takst.code)) return 70;
    if (/^70/.test(takst.code) || ["707", "708a", "705k"].includes(takst.code)) return 50;
    if (takst.code === "2cd") return 40;
    return 60;
  }

  function resolveBillingSuggestions({ sheetAnswers, extraTriggerMatches = [], tariffData }) {
    const { triggers, sourcesByTrigger } = resolveTriggersFromSheet(sheetAnswers, tariffData);

    extraTriggerMatches.forEach((match) => {
      (match.triggers || []).forEach((trigger) => {
        triggers.add(trigger);
        const sources = sourcesByTrigger.get(trigger) || [];
        sources.push(`Ekstra punkt lagt til - "${match.text}"`);
        sourcesByTrigger.set(trigger, sources);
      });
    });

    const codes = resolveCodesFromTriggers(triggers, tariffData);
    const validated = validateCombinations(fetchTakster(codes, tariffData));
    const consultationMap = tariffData.consultation_trigger_map || {};

    return validated.map((takst) => {
      const triggerSources = [...triggers]
        .filter((trigger) => (consultationMap[trigger] || []).includes(takst.code))
        .flatMap((trigger) => sourcesByTrigger.get(trigger) || [trigger]);

      return {
        ...takst,
        sources: [...new Set(triggerSources)].slice(0, 4)
      };
    });
  }

  function daysUntilTariffExpiry(meta, now = new Date()) {
    if (!meta?.valid_to) return null;
    const expires = new Date(`${meta.valid_to}T00:00:00`);
    if (Number.isNaN(expires.getTime())) return null;
    return Math.ceil((expires.getTime() - now.getTime()) / 86400000);
  }

  function shouldWarnTariffExpiry(meta, now = new Date()) {
    const daysRemaining = daysUntilTariffExpiry(meta, now);
    if (daysRemaining === null) return false;
    return daysRemaining <= Number(meta.expiry_warning_days || 0);
  }

  function formatMoneyLine(takst) {
    const values = [];
    if (takst.hon) values.push(`Hon: ${takst.hon} kr`);
    if (takst.ref) values.push(`Ref: ${takst.ref} kr`);
    if (takst.egen) values.push(`Egenandel: ${takst.egen} kr`);
    return values.join(" · ");
  }

  function truncateDescription(text, maxLength = 36) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
  }

  function formatTakstBlock(takster) {
    const kept = takster || [];
    if (kept.length === 0) return "";
    const lines = kept.map((takst) => {
      const amountLabel = /^10[a-d]$/.test(takst.code) ? "Egen" : "Hon";
      const amount = /^10[a-d]$/.test(takst.code) ? takst.egen : takst.hon;
      return `${takst.code.padEnd(4, " ")}  ${truncateDescription(takst.short_description).padEnd(38, " ")} ${amountLabel}: ${String(amount || 0).padStart(4, " ")} kr`;
    });

    return [
      "--- Takster ---",
      ...lines,
      "────────────────────────────────────────────────────────",
      "Takstforslag er veiledende. Legen bekrefter riktig",
      "takstbruk og er ansvarlig for innrapportering til HELFO."
    ].join("\n");
  }

  const api = {
    normalizeAnswerValue,
    normalizeQuestionKey,
    resolveTriggersFromSheet,
    resolveCodesFromTriggers,
    fetchTakster,
    validateCombinations,
    resolveBillingSuggestions,
    daysUntilTariffExpiry,
    shouldWarnTariffExpiry,
    formatMoneyLine,
    formatTakstBlock
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.ConsultAssistBilling = api;
})(typeof window !== "undefined" ? window : globalThis);
