const OPENAI_MODEL = "gpt-5.2";
const SHEET_BUCKET = "consultassist-sheet-templates";

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const input = normalizeRequestBody(req.body);
    validateInput(input);

    const cached = await readCachedSheet(input.cacheKey);
    if (cached) {
      return send(res, 200, { sheet: cached, cacheHit: true });
    }

    const sheet = await generateSheet(input);
    await writeCachedSheet(input.cacheKey, sheet);

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

  if (containsDirectIdentifier(input.presentation)) {
    const error = new Error("Presentation contains direct identifier");
    error.statusCode = 400;
    error.publicMessage = "Remove direct patient identifiers before generating a sheet";
    throw error;
  }
}

function containsDirectIdentifier(text) {
  return [
    /\b\d{11}\b/,
    /\b\d{6}\s?\d{5}\b/,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?:\+47\s?)?(?:\d\s?){8}\b/,
    /\b(navn|pasientnavn|fødselsnummer|personnummer|telefon|e-post)\s*[:=]\s*[^\n,;.]+/i
  ].some((pattern) => pattern.test(text));
}

async function readCachedSheet(cacheKey) {
  if (!hasSupabaseEnv()) return null;

  const response = await fetch(storageObjectUrl(cacheKey), {
    method: "GET",
    headers: supabaseHeaders()
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    console.warn("Supabase cache read failed", response.status, await response.text());
    return null;
  }

  return response.json();
}

async function writeCachedSheet(cacheKey, sheet) {
  if (!hasSupabaseEnv()) return;

  const response = await fetch(storageObjectUrl(cacheKey), {
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

function storageObjectUrl(cacheKey) {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
  return `${baseUrl}/storage/v1/object/${SHEET_BUCKET}/${objectName(cacheKey)}`;
}

function objectName(cacheKey) {
  const safeName = Buffer.from(cacheKey).toString("base64url");
  return `${safeName}.json`;
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
  return normalizeAiSheet(parsed, input.cacheKey);
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

function normalizeAiSheet(sheet, cacheKey) {
  return {
    title: sheet.title,
    goal: sheet.goal,
    redFlags: sheet.redFlags,
    questions: sheet.questions.map((entry, index) => item(entry.id || `q${index + 1}`, entry.label, entry.why, entry.buttons, entry.placeholder)),
    examinations: sheet.examinations.map((entry, index) => item(entry.id || `e${index + 1}`, entry.label, entry.why, entry.buttons, entry.placeholder)),
    followUp: sheet.followUp,
    cacheKey,
    createdAt: new Date().toISOString(),
    source: "openai"
  };
}

function item(id, label, why, buttons, placeholder) {
  return { id, label, why, buttons, placeholder };
}

function sheetJsonSchema() {
  const option = {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "why", "buttons", "placeholder"],
    properties: {
      id: { type: "string" },
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
