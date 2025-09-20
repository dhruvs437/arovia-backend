// src/services/analyzeService.ts
import logger from '../utils/logger';
import { analyzeWithGroq } from './groqAdapter';
import { z } from 'zod';

/**
 * Simple retry wrapper for transient Groq/network errors.
 */
async function withRetries<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 500): Promise<T> {
  let lastErr: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status || err?.status || err?.code;
      
      // Check for Groq-specific rate limit error
      const isRateLimit = err?.message?.includes('rate limit') || status === 429;
      
      // retry on rate limit, 5xx or network issue
      if (isRateLimit || (typeof status === 'number' && status >= 500) || !status) {
        const delay = baseDelayMs * Math.pow(2, i);
        logger.warn({ err, attempt: i + 1, delay }, 'Transient error from analyzeWithGroq — retrying');
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // non-transient -> rethrow
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Expected output schema (partial) — use zod to validate essential fields.
 * You can expand this schema if you require stricter validation.
 */
const PredictionSchema = z.object({
  condition: z.string(),
  years: z.number().int().nonnegative(),
  probability_pct: z.number(),
  rationale: z.string().optional(),
  preventable: z.boolean().optional(),
  interventions: z.array(z.string()).optional(),
  citations: z.array(z.string()).optional()
});

const AnalysisSchema = z.object({
  model_version: z.string(),
  generated_on: z.string(),
  summary: z.string().optional(),
  predictions: z.array(PredictionSchema),
  explainability: z.object({
    top_features: z.array(z.object({ feature: z.string(), impact: z.number() }))
  }).optional()
});

/**
 * Replace the previous heuristic implementation — call the Groq adapter to generate analysis.
 *
 * @param userId - id of the user
 * @param mergedPayload - merged health + lifestyle object
 * @param healthDatabases - optional names of health DBs for model guidance
 * @param options - optional configuration for model selection and parameters
 */
export async function analyzeMerged(
  userId: string,
  mergedPayload: any,
  healthDatabases?: string[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
) {
  // Defensive: ensure we have something to send
  if (!mergedPayload) {
    throw new Error('mergedPayload is required');
  }

  // Call Groq adapter with retries
  const rawResult = await withRetries(() =>
    analyzeWithGroq({
      userId,
      mergedData: mergedPayload,
      healthDatabases,
      model: options?.model || process.env.GROQ_MODEL || 'llama-3.2-70b-versatile',
      temperature: options?.temperature || 0.7,
      max_tokens: options?.max_tokens || 1200,
    })
  );

  // Validate shape
  const parsed = AnalysisSchema.safeParse(rawResult);
  if (!parsed.success) {
    logger.error({ rawResult, issues: parsed.error.format() }, 'Groq returned invalid analysis schema');
    throw new Error('Invalid analysis result from Groq');
  }

  // Optionally normalize numeric values (round probabilities to 1 decimal)
  const analysis = parsed.data;
  analysis.predictions = analysis.predictions.map((p) => ({
    ...p,
    probability_pct:
      typeof p.probability_pct === 'number'
        ? Math.round(p.probability_pct * 10) / 10
        : p.probability_pct
  }));

  // Attach model metadata if missing
  analysis.model_version = analysis.model_version || process.env.GROQ_MODEL || 'llama-3.2-70b-versatile';
  analysis.generated_on = analysis.generated_on || new Date().toISOString();

  logger.info({ 
    userId, 
    model: analysis.model_version, 
    predictions: analysis.predictions.length 
  }, 'analysis completed with Groq');

  return analysis;
}

/**
 * Helper function to select appropriate Groq model based on use case
 * 
 * @param priority - 'quality' | 'speed' | 'balanced'
 * @returns model name string
 */
export function selectGroqModel(priority: 'quality' | 'speed' | 'balanced' = 'balanced'): string {
  switch (priority) {
    case 'quality':
      // Best quality for medical analysis
      return 'llama-3.2-70b-versatile';
    case 'speed':
      // Fastest inference for quick responses
      return 'llama-3.2-8b-instant';
    case 'balanced':
    default:
      // Good balance of speed and quality
      return 'mixtral-8x7b-32768';
  }
}

/**
 * Rate limit aware batch processing for multiple analyses
 * Groq free tier: 30 requests/minute
 * 
 * @param analyses - array of analysis requests
 * @param batchSize - number of concurrent requests (default 5)
 * @param delayMs - delay between batches (default 2000ms)
 */
export async function analyzeBatch(
  analyses: Array<{
    userId: string;
    mergedPayload: any;
    healthDatabases?: string[];
  }>,
  batchSize = 5,
  delayMs = 2000
): Promise<any[]> {
  const results: any[] = [];
  
  for (let i = 0; i < analyses.length; i += batchSize) {
    const batch = analyses.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(({ userId, mergedPayload, healthDatabases }) =>
        analyzeMerged(userId, mergedPayload, healthDatabases)
      )
    );
    
    // Collect results and handle failures
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error({ 
          error: result.reason, 
          userId: batch[idx].userId 
        }, 'Batch analysis failed for user');
        results.push(null); // or handle error as needed
      }
    });
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < analyses.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}