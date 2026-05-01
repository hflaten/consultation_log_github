const OPENAI_MODEL = "gpt-5.2";
const SHEET_BUCKET = "consultassist-sheet-templates";
const REVIEW_METADATA_VERSION = "review-v1";
const REVIEWED_PREFIX = "reviewed";
const DRAFT_PREFIX = "drafts";

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const input = normalizeRequestBody(req.body);
    const action = input.action || "generate";

    if (action === "review") {
      validateReviewInput(input);
      const reviewedSheet = markSheetReviewed(input.sheet, input);
      await writeCachedSheet(input.cacheKey, reviewedSheet, REVIEWED_PREFIX);
      return send(res, 200, { sheet: reviewedSheet, cacheHit: true, reviewSaved: true });
    }

    validateInput(input);

    const sourceBasis = input.sourceBasis || input.reviewBasis || null;
    const cached = await readCachedSheet(input.cacheKey, sourceBasis);
    if (cached) {
      return send(res, 200, { sheet: cached, cacheHit: true });
    }

    const sheet = await generateSheet({ ...input, sourceBasis });
    await writeCachedSheet(input.cacheKey, sheet, DRAFT_PREFIX);

    return send(res, 200, { sheet, cacheHit: false });
  } catch (error) {
    console.error(error);
    return send(res, error.statusCode || 500, {
      error: error.publicMessage || "Could not generate consultation sheet"
    });
  }
};

function normalizeRequestBody(body) {
  if (!body) return {};
  if (typeof body === "string") return JSON.parse(body);
  return body;
}

function validateInput(input) {
  const required = ["cacheKey", "age", "sex", "sheetType", "presentation", "prompt"];
  for (const key of required) {
    if (typeof input[key] !== "string" || input[key].trim().length === 0) {
      const error = new Error(`Missing ${key}`);
      error.statusCode = 400;
      error.publicMessage = `Missing ${key}`;
      throw error;
    }
  }

  if (input.presentation.length > 3000 || input.prompt.length > 5000) {
    const error = new Error("Input too long");
    error.statusCode = 413;
    error.publicMessage = "Input is too long";
    throw error;
  }
}

function validateReviewInput(input) {
  if (typeof input.cacheKey !== "string" || input.cacheKey.trim().length === 0) {
    const error = new Error("Missing cacheKey");
    error.statusCode = 400;
    error.publicMessage = "Missing cacheKey";
    throw error;
  }

  if (!input.sheet || typeof input.sheet !== "object") {
    const error = new Error("Missing sheet");
    error.statusCode = 400;
    error.publicMessage = "Missing sheet";
    throw error;
  }

  if (typeof input.reviewer !== "string" || input.reviewer.trim().length === 0) {
    const error = new Error("Missing reviewer");
    error.statusCode = 400;
    error.publicMessage = "Reviewer is required";
    throw error;
  }
}

async function readCachedSheet(cacheKey, sourceBasis) {
  if (!hasSupabaseEnv()) return null;

  for (const prefix of [REVIEWED_PREFIX, DRAFT_PREFIX, null]) {
    const response = await fetch(storageObjectUrl(cacheKey, prefix), {
      method: "GET",
      headers: supabaseHeaders()
    });

    if (response.status === 404) continue;
    if (!response.ok) {
      console.warn("Supabase cache read failed", response.status, await response.text());
      continue;
    }

    const sheet = normalizeCachedSheet(await response.json(), cacheKey);
    if (isCurrentSourceBasis(sheet.review?.sourceBasis, sourceBasis)) return sheet;
  }

  return null;
}

async function writeCachedSheet(cacheKey, sheet, prefix) {
  if (!hasSupabaseEnv()) return;

  const response = await fetch(storageObjectUrl(cacheKey, prefix), {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": "application/json",
      "x-upsert": "true"
    },
    body: JSON.stringify(sheet)
  });

  if (!response.ok) {
    console.warn("Supabase cache write failed", response.status, await response.text());
  }
}

function hasSupabaseEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function storageObjectUrl(cacheKey, prefix) {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
  return `${baseUrl}/storage/v1/object/${SHEET_BUCKET}/${objectName(cacheKey, prefix)}`;
}

function objectName(cacheKey, prefix) {
  const safeName = Buffer.from(cacheKey).toString("base64url");
  return prefix ? `${prefix}/${safeName}.json` : `${safeName}.json`;
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
  };
}

async function generateSheet(input) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.statusCode = 503;
    error.publicMessage = "AI is not configured yet";
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_output_tokens: 3500,
      instructions: [
        "Du lager strukturerte konsultasjonsark for fastleger i Norge.",
        "Svar kun med JSON som matcher skjemaet.",
        "Ikke gi endelig diagnose. Verktøyet er beslutningsstøtte for lege.",
        "Ikke inkluder personidentifiserende informasjon i gjenbrukbare arkmaler.",
        "Bruk norsk bokmål, korte praktiske formuleringer, røde flagg og tydelig oppfølging."
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                age: input.age,
                sex: input.sex,
                sheetType: input.sheetType,
                firstEpisode: input.firstEpisode || "ukjent",
                timeBudgetMinutes: input.timeBudgetMinutes || "15",
                careSetting: "fastlegekontor i Norge",
                language: "nb-NO",
                presentation: input.presentation,
                prompt: input.prompt,
                cacheKey: input.cacheKey,
                sourceHierarchy: [
                  "Helsedirektoratet: nasjonale faglige retningslinjer, veiledere, faglige råd, pasientforløp og pakkeforløp når relevant.",
                  "Helsebiblioteket: offentlig inngang til fagressurser og retningslinjer.",
                  "NEL-lignende allmennlegeflyt: kun arbeidsmønster for anamnese og undersøkelse, ikke kopiert proprietært innhold."
                ],
                clinicalMethod: [
                  "hovedproblem/presentasjonsklage",
                  "sykehistorie",
                  "tidligere sykdommer",
                  "legemidler og allergier",
                  "sosial/familie-kontekst",
                  "ICE",
                  "røde flagg",
                  "målrettet undersøkelse",
                  "plan og sikkerhetsnett"
                ]
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "consultassist_sheet",
          strict: true,
          schema: sheetJsonSchema()
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`OpenAI request failed ${response.status}: ${text}`);
    error.statusCode = 502;
    error.publicMessage = "AI request failed";
    throw error;
  }

  const data = await response.json();
  const parsed = parseResponseJson(data);
  return normalizeAiSheet(parsed, input.cacheKey, input.sourceBasis);
}

function parseResponseJson(data) {
  if (typeof data.output_text === "string") {
    return JSON.parse(data.output_text);
  }

  const text = data.output
    ?.flatMap((item) => item.content || [])
    ?.filter((part) => part.type === "output_text" && typeof part.text === "string")
    ?.map((part) => part.text)
    ?.join("");

  if (!text) throw new Error("AI response did not contain output_text");
  return JSON.parse(text);
}

function normalizeAiSheet(sheet, cacheKey, sourceBasis) {
  return {
    title: sheet.title,
    goal: sheet.goal,
    redFlags: sheet.redFlags,
    questions: sheet.questions.map((entry, index) => item(entry.id || `q${index + 1}`, entry.label, entry.why, entry.buttons, entry.placeholder, entry.section || "Anamnese")),
    examinations: sheet.examinations.map((entry, index) => item(entry.id || `e${index + 1}`, entry.label, entry.why, entry.buttons, entry.placeholder, entry.section || "Undersøkelser")),
    followUp: sheet.followUp,
    cacheKey,
    createdAt: new Date().toISOString(),
    source: "openai",
    review: createReviewMetadata({
      status: "unreviewed",
      reviewer: null,
      reviewedAt: null,
      sourceBasis
    })
  };
}

function normalizeCachedSheet(sheet, cacheKey) {
  return {
    ...sheet,
    cacheKey: sheet.cacheKey || cacheKey,
    review: createReviewMetadata({
      status: sheet.review?.status === "reviewed" ? "reviewed" : "unreviewed",
      reviewer: sheet.review?.reviewer || null,
      reviewedAt: sheet.review?.reviewedAt || sheet.review?.date || null,
      sourceBasis: sheet.review?.sourceBasis || null
    })
  };
}

function markSheetReviewed(sheet, input) {
  const reviewedAt = new Date().toISOString();

  return {
    title: sheet.title,
    goal: sheet.goal,
    redFlags: Array.isArray(sheet.redFlags) ? sheet.redFlags : [],
    questions: Array.isArray(sheet.questions) ? sheet.questions.map((entry, index) => item(entry.id || `q${index + 1}`, entry.label, entry.why, entry.buttons || [], entry.placeholder || "", entry.section || "Anamnese")) : [],
    examinations: Array.isArray(sheet.examinations) ? sheet.examinations.map((entry, index) => item(entry.id || `e${index + 1}`, entry.label, entry.why, entry.buttons || [], entry.placeholder || "", entry.section || "Undersøkelser")) : [],
    followUp: Array.isArray(sheet.followUp) ? sheet.followUp : [],
    cacheKey: input.cacheKey,
    createdAt: sheet.createdAt || reviewedAt,
    source: sheet.source || "clinician_review",
    review: createReviewMetadata({
      status: "reviewed",
      reviewer: input.reviewer.trim(),
      reviewedAt,
      sourceBasis: input.sourceBasis || input.reviewBasis || sheet.review?.sourceBasis || null
    })
  };
}

function createReviewMetadata({ status, reviewer, reviewedAt, sourceBasis }) {
  return {
    status,
    reviewer,
    reviewedAt,
    date: reviewedAt,
    sourceBasis: sourceBasis || null,
    version: REVIEW_METADATA_VERSION
  };
}

function isCurrentSourceBasis(sheetBasis, requestedBasis) {
  if (!requestedBasis) return true;
  if (!sheetBasis) return false;

  return ["promptHash", "promptVersion", "schemaVersion", "sourceVersion", "templateVersion"]
    .every((key) => sheetBasis[key] === requestedBasis[key]);
}

function item(id, label, why, buttons, placeholder, section) {
  return { id, section, label, why, buttons, placeholder };
}

function sheetJsonSchema() {
  const option = {
    type: "object",
    additionalProperties: false,
    required: ["id", "section", "label", "why", "buttons", "placeholder"],
    properties: {
      id: { type: "string" },
      section: { type: "string" },
      label: { type: "string" },
      why: { type: "string" },
      buttons: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: { type: "string" }
      },
      placeholder: { type: "string" }
    }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "goal", "redFlags", "questions", "examinations", "followUp"],
    properties: {
      title: { type: "string" },
      goal: { type: "string" },
      redFlags: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: { type: "string" }
      },
      questions: {
        type: "array",
        minItems: 5,
        maxItems: 12,
        items: option
      },
      examinations: {
        type: "array",
        minItems: 3,
        maxItems: 10,
        items: option
      },
      followUp: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: { type: "string" }
      }
    }
  };
}

function setJsonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}
