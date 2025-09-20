// src/services/groqAdapter.ts
import Groq from "groq-sdk";

/**
 * Groq client. Ensure process.env.GROQ_API_KEY is set in your .env for dev.
 */
const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * Small sanitizer to drop clear PII fields (name, email, phone, ABHA id).
 */
export function sanitizePayload(raw: any) {
  const copy = JSON.parse(JSON.stringify(raw));
  // Remove or pseudonymize obvious identifiers
  delete copy.name;
  delete copy.email;
  delete copy.phone;
  if (copy.abha_id) {
    copy.abha_id = `user_${String(copy.abha_id).slice(-6)}`; // pseudonymize
  }
  // Optionally trim long free-text notes
  if (copy.notes && typeof copy.notes === "string") {
    copy.notes = copy.notes.slice(0, 1000);
  }
  return copy;
}

/**
 * analyzeWithGroq
 *
 * This function asks the Groq LLM to analyze the mergedData. The important change:
 * - mergedData is expected to include baselineRecords (an array of recent health records)
 *   and lifestyle (the scenario to project).
 * - The model is instructed to return JSON with `baseline`, `projection`, and `deltas`.
 *
 * The function is robust: it tries to parse direct JSON, extracts the first JSON object if the model emits extra text,
 * and it ensures model_version + generated_on fields exist before returning.
 */
export async function analyzeWithGroq({
  userId,
  mergedData,
  healthDatabases = ["NHANES", "PubMed", "WHO", "ADA", "AHA"],
  model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  max_tokens = 1200,
  temperature = 0.0, // deterministic by default for analysis
}: {
  userId: string;
  mergedData: any;
  healthDatabases?: string[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
}) {
  const sanitized = sanitizePayload(mergedData);

  // System prompt: strong constraints and JSON-only output
  const systemPrompt = `You are a medical analysis assistant for prototyping only (not a doctor).
You will be given anonymized patient baselineRecords (labs, vitals, medications, diagnoses) and a scenario "lifestyle" describing the patient's lifestyle going forward.
Produce strictly valid JSON only (no extra commentary).`;

  // Explicit schema instructions: require baseline + projection + deltas
  // (We also accept legacy 'predictions' outputs — the caller will handle fallback.)
  const userContent = `
INPUT (anonymized):
${JSON.stringify(sanitized, null, 2)}

REQUIRED OUTPUT (JSON only) — must match this shape exactly (fields may be empty arrays where appropriate):

{
  "model_version": "string",
  "generated_on": "ISO datetime string",
  "summary": "short string (<=2 sentences)",
  "baseline": {
    "predictions": [
      {
        "condition": "string",
        "years": number,
        "probability_pct": number,
        "rationale": "string",
        "preventable": boolean,
        "interventions": ["string"],
        "citations": ["string"]
      }
    ]
  },
  "projection": {
    "predictions": [ /* same shape as baseline.predictions */ ]
  },
  "deltas": [
    {
      "condition": "string",
      "baseline_pct": number,
      "projection_pct": number,
      "delta_pct": number
    }
  ],
  "explainability": {
    "top_features": [
      { "feature": "string", "impact": number }
    ]
  }
}

INSTRUCTIONS:
- Use baselineRecords to compute the patient's current (baseline) risk per major condition (e.g., Type 2 Diabetes, Cardiovascular Disease, Kidney Disease).
- Use the provided "lifestyle" object to compute a projected risk if that lifestyle continues.
- For each condition present in baseline or projection produce a delta entry = projection_pct - baseline_pct (use -1 where unknown).
- When citing evidence, pick named sources from this guidance list or use "no citation available" if unsure.
Background guidance sources: ${healthDatabases.join(", ")}.

If you are uncertain about numeric probabilities, set probability_pct to -1 and citations: ["no citation available"] rather than fabricating numbers.
Return valid JSON only. Do not include any free-form text or explanation outside the JSON object.
`;

  try {
    // Call Groq API — use chat completions when supported. response_format json_object helps the model produce JSON.
    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      model,
      max_tokens,
      temperature,
      // Groq's json_object mode will return pure JSON for compatible models; keep this but tolerate text outputs too.
      response_format: { type: "json_object" },
    });

    // Try to capture usage if returned (helpful for monitoring)
    const usage = (chatCompletion as any).usage;
    if (usage) {
      console.log("Groq usage:", {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      });
    }

    // Extract the raw content — different SDK versions may return different shapes.
    // Some shapes: choices[0].message.content (string), or choices[0].message.content (object) if json_object mode applied.
    const firstChoice = (chatCompletion as any).choices?.[0];
    let outputContent = firstChoice?.message?.content ?? firstChoice?.message ?? null;

    // If Groq returned a parsed JSON object directly (not a string), use it.
    if (outputContent && typeof outputContent === "object" && !Array.isArray(outputContent)) {
      const parsedObj = outputContent;
      parsedObj.model_version = parsedObj.model_version || `${model}-v1`;
      parsedObj.generated_on = parsedObj.generated_on || new Date().toISOString();
      return parsedObj;
    }

    // Otherwise, treat outputContent as string
    const outputText = typeof outputContent === "string" ? outputContent : null;
    if (!outputText) {
      throw new Error("Groq returned no textual output");
    }

    // Attempt to parse JSON directly, then fallback to extracting first JSON block
    let parsed: any;
    try {
      parsed = JSON.parse(outputText);
    } catch (err) {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error("Failed to parse JSON from the model output after extracting JSON block");
        }
      } else {
        throw new Error("Failed to parse JSON from model output and no JSON block found");
      }
    }

    // Ensure metadata fields exist and return
    parsed.model_version = parsed.model_version || `${model}-v1`;
    parsed.generated_on = parsed.generated_on || new Date().toISOString();

    return parsed;

  } catch (error: any) {
    // Provide clearer error messages for common cases
    console.error("Groq API error:", error);

    // rate-limit handling / insufficient access
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("rate limit") || msg.includes("quota")) {
      throw new Error("Groq rate limit or quota error — try again later.");
    }
    if (msg.includes("model_not_found") || msg.includes("does not exist") || msg.includes("not supported")) {
      throw new Error(`Model error from Groq: ${error.message}`);
    }

    // Re-throw original error if not a known transient case
    throw error;
  }
}

/**
 * GROQ_MODELS: recommended model constants you can import/use elsewhere.
 */
export const GROQ_MODELS = {
  BEST: "llama-3.3-70b-versatile",       // high quality / large context
  FAST: "llama-3.1-8b-instant",          // faster, cheaper
  JSON_OPTIMIZED: "groq/compound-mini",  // if you want a JSON-focused model
} as const;
