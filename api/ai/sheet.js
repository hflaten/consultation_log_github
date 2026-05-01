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
        "Bruk norsk bokmål, korte praktiske formuleringer, røde flagg og tydelig oppfølging.",
        "Grupper anamnesespørsmål i fastlege-struktur: hovedproblem, sykehistorie, tidligere sykdommer, medisiner/allergier, sosialt/familie/relevant kontekst, ICE og røde flagg.",
        "Hvert spørsmål skal ha questionType lik open, specific eller yes_no. Start relevante grupper med ett åpent spørsmål før mer strukturerte knapper.",
        "Ta med ICE når relevant for vanlig fastlegekonsultasjon, men hold ICE kort ved akuttvurdering eller tydelig triage."
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
                careSetting: "fastlegekontor i Norge",
                language: "nb-NO",
                presentation: input.presentation,
                prompt: input.prompt,
                cacheKey: input.cacheKey
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
  const anamneseGroups = normalizeAnamneseGroups(sheet);
  const examinations = normalizeItems(sheet.examinations, "e");

  return {
    title: sheet.title,
    goal: sheet.goal,
    redFlags: sheet.redFlags,
    anamneseGroups,
    questions: flattenGroups(anamneseGroups),
    examinations,
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
  const anamneseGroups = normalizeAnamneseGroups(sheet);

  return {
    ...sheet,
    anamneseGroups,
    questions: flattenGroups(anamneseGroups),
    examinations: normalizeItems(sheet.examinations, "e"),
    redFlags: Array.isArray(sheet.redFlags) ? sheet.redFlags : [],
    followUp: Array.isArray(sheet.followUp) ? sheet.followUp : [],
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
  const anamneseGroups = normalizeAnamneseGroups(sheet);

  return {
    title: sheet.title,
    goal: sheet.goal,
    redFlags: Array.isArray(sheet.redFlags) ? sheet.redFlags : [],
    anamneseGroups,
    questions: flattenGroups(anamneseGroups),
    examinations: normalizeItems(sheet.examinations, "e"),
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

function normalizeAnamneseGroups(sheet) {
  if (Array.isArray(sheet.anamneseGroups) && sheet.anamneseGroups.length > 0) {
    return sheet.anamneseGroups.map((group, groupIndex) => {
      const title = group.title || legacyCategoryTitle(group.category) || `Anamnese ${groupIndex + 1}`;
      const id = group.id || slugify(title) || `anamnese-${groupIndex + 1}`;

      return {
        id,
        title,
        items: normalizeItems(group.items || group.questions, `q${groupIndex + 1}`, id, title)
      };
    }).filter((group) => group.items.length > 0);
  }

  if (Array.isArray(sheet.questions) && sheet.questions.length > 0) {
    return [{
      id: "sykehistorie",
      title: "Sykehistorie",
      items: normalizeItems(sheet.questions, "q", "sykehistorie", "Sykehistorie")
    }];
  }

  return [];
}

function normalizeItems(entries, prefix, categoryId = null, categoryTitle = null) {
  if (!Array.isArray(entries)) return [];

  return entries.map((entry, index) => item(
    entry.id || `${prefix}${index + 1}`,
    entry.label,
    entry.why,
    entry.buttons || entry.answer_buttons,
    entry.placeholder || entry.free_text_placeholder,
    entry.questionType || entry.question_type,
    categoryId || entry.categoryId || null,
    categoryTitle || entry.categoryTitle || null
  ));
}

function flattenGroups(groups) {
  return groups.flatMap((group) => group.items.map((entry) => ({
    ...entry,
    categoryId: group.id,
    categoryTitle: group.title
  })));
}

function legacyCategoryTitle(category) {
  const titles = {
    main_complaint: "Hovedproblem / presentasjonsklage",
    history: "Sykehistorie",
    past_medical_history: "Tidligere sykdommer",
    medications_allergies: "Medisiner og allergier",
    social_family_context: "Sosialt/familie/relevant kontekst",
    ice: "ICE",
    red_flags: "Røde flagg"
  };

  return titles[category] || "";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function questionType(value) {
  return ["open", "specific", "yes_no"].includes(value) ? value : "specific";
}

function item(id, label, why, buttons, placeholder, type = "specific", categoryId = null, categoryTitle = null) {
  return {
    id,
    label: label || "",
    why: why || "",
    buttons: Array.isArray(buttons) ? buttons : [],
    placeholder: placeholder || "",
    questionType: questionType(type),
    categoryId,
    categoryTitle
  };
}

function sheetJsonSchema() {
  const option = {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "why", "buttons", "placeholder", "questionType"],
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      why: { type: "string" },
      questionType: { type: "string", enum: ["open", "specific", "yes_no"] },
      buttons: {
        type: "array",
        minItems: 0,
        maxItems: 5,
        items: { type: "string" }
      },
      placeholder: { type: "string" }
    }
  };

  const anamneseGroup = {
    type: "object",
    additionalProperties: false,
    required: ["id", "title", "items"],
    properties: {
      id: { type: "string" },
      title: {
        type: "string",
        enum: [
          "Hovedproblem / presentasjonsklage",
          "Sykehistorie",
          "Tidligere sykdommer",
          "Medisiner og allergier",
          "Sosialt/familie/relevant kontekst",
          "ICE",
          "Røde flagg"
        ]
      },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: option
      }
    }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "goal", "redFlags", "anamneseGroups", "examinations", "followUp"],
    properties: {
      title: { type: "string" },
      goal: { type: "string" },
      redFlags: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: { type: "string" }
      },
      anamneseGroups: {
        type: "array",
        minItems: 5,
        maxItems: 7,
        items: anamneseGroup
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
