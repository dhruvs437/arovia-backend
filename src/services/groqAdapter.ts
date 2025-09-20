// src/services/groqAdapter.ts
import Groq from "groq-sdk";

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
 * Ask Groq LLM to analyze merged data and return strictly formatted JSON.
 * healthDatabases: array of named health databases/resources (e.g. "NHANES", "PubMed", "WHO")
 * The model will indicate which of those named databases it uses to support claims, or "no citation available".
 *
 * NOTE: The model does NOT fetch these databases in real time — they're guidance for the model's internal knowledge.
 */
export async function analyzeWithGroq({
  userId,
  mergedData,
  healthDatabases = ["NHANES", "PubMed", "WHO", "ADA", "AHA"],
  model = process.env.GROQ_MODEL || "llama-3.2-70b-versatile",
  max_tokens = 1200,
  temperature = 0.7,
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
  const systemPrompt = `You are a medical-advice assistant for prototyping only (not a doctor).
  You will be given anonymized patient data (labs, vitals, diagnoses, lifestyle).
  Provide a concise JSON object with:
  - 1-2 sentence summary,
  - predicted conditions and timeline (years) with probability percentages,
  - short rationale for each prediction,
  - interventions (actionable lifestyle steps),
  - top contributing features.
  
  Return valid JSON only. Do not include any free-form text outside the JSON.`;

  // Full assistant_instructions JSON schema (strict)
  const assistant_instructions = {
    schema: {
      model_version: "string",
      generated_on: "string (ISO datetime)",
      summary: "short string (<=2 sentences)",
      predictions: [
        {
          condition: "string",
          years: "number",
          probability_pct: "number",
          rationale: "string (1-2 sentences)",
          preventable: "boolean",
          interventions: ["string"],
          citations: ["string (named database like 'NHANES' or 'PubMed' or 'no citation available')"]
        }
      ],
      explainability: {
        top_features: [
          { feature: "string", impact: "number (positive increases risk, negative decreases)" }
        ]
      },
      notes: "Return only JSON that validates against this schema. Do not include free-form text outside JSON."
    },
    notes:
      "This JSON will be validated downstream. Return only JSON. Do not include additional commentary or markup."
  };

  // Build the user content payload the model will see
  const userContent = `
Anonymized patient data (JSON):
${JSON.stringify(sanitized, null, 2)}

Assistant instructions (JSON schema):
${JSON.stringify(assistant_instructions, null, 2)}

Background guidance: ${healthDatabases.join(", ")}
For each predicted condition, include supporting named database(s) from the list above or "no citation available".
If uncertain, return probability_pct: -1 and citations: ["no citation available"] rather than fabricating values.
`;

  try {
    // Call Groq API with chat completions
    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      model,
      max_tokens,
      temperature,
      response_format: { type: "json_object" }, // Groq supports JSON mode for compatible models
    });

    // Log usage for monitoring
    const usage = chatCompletion.usage;
    if (usage) {
      console.log("Groq usage:", {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      });
    }

    // Extract the response content
    const outputText = chatCompletion.choices[0]?.message?.content;

    if (!outputText) {
      throw new Error("Groq returned no textual output");
    }

    // Attempt to parse JSON-only output
    let parsed: any;
    try {
      parsed = JSON.parse(outputText);
    } catch (err) {
      // Attempt to extract the first JSON object in the text
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

    // Ensure metadata fields exist
    parsed.model_version = parsed.model_version || `${model}-v1`;
    parsed.generated_on = parsed.generated_on || new Date().toISOString();

    return parsed;

  } catch (error) {
    console.error("Groq API error:", error);
    
    // Handle rate limiting specifically
    if (error instanceof Error && error.message.includes("rate limit")) {
      throw new Error("Rate limit reached. Please try again in a moment.");
    }
    
    throw error;
  }
}

/**
 * Alternative models available on Groq (for different use cases):
 * 
 * Best for medical/general:
 * - "llama-3.2-70b-versatile" (recommended - best quality)
 * - "llama-3.2-8b-instant" (faster, lower quality)
 * 
 * Best for structured data/JSON:
 * - "mixtral-8x7b-32768" (good for JSON outputs)
 * 
 * Fastest inference:
 * - "llama-3.2-3b-preview" (ultra-fast, basic quality)
 * 
 * You can switch models based on your needs:
 * - Development/testing: use smaller models for speed
 * - Production: use larger models for quality
 */
export const GROQ_MODELS = {
  BEST: "llama-3.2-70b-versatile",
  FAST: "llama-3.2-8b-instant", 
  ULTRA_FAST: "llama-3.2-3b-preview",
  JSON_OPTIMIZED: "mixtral-8x7b-32768",
} as const;