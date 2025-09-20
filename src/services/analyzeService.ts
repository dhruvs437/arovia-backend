// src/services/analyzeService.ts
import logger from '../utils/logger';
import { analyzeWithGroq } from './groqAdapter';
import { z } from 'zod';

async function withRetries<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      logger.warn({ attempt: i + 1, error: (err as Error).message }, 'Retrying analyzeWithGroq...');
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

// Retry wrapper (keep your existing withRetries function)...

// New expected schema (baseline + projection + delta)
const Pred = z.object({
  condition: z.string(),
  years: z.number(),
  probability_pct: z.number(),
  rationale: z.string().optional(),
  preventable: z.boolean().optional(),
  interventions: z.array(z.string()).optional(),
  citations: z.array(z.string()).optional()
});

const AnalysisV2 = z.object({
  model_version: z.string(),
  generated_on: z.string(),
  summary: z.string().optional(),
  baseline: z.object({
    predictions: z.array(Pred)
  }).optional(),
  projection: z.object({
    predictions: z.array(Pred)
  }).optional(),
  deltas: z.array(z.object({
    condition: z.string(),
    baseline_pct: z.number(),
    projection_pct: z.number(),
    delta_pct: z.number()
  })).optional(),
  explainability: z.object({
    top_features: z.array(z.object({ feature: z.string(), impact: z.number() }))
  }).optional()
});

// Backwards-compatible older Analysis schema
const LegacyAnalysis = z.object({
  model_version: z.string().optional(),
  generated_on: z.string().optional(),
  summary: z.string().optional(),
  predictions: z.array(Pred).optional(),
  explainability: z.any().optional()
});

export async function analyzeMerged(
  userId: string,
  mergedPayload: any,
  healthDatabases?: string[],
  options?: { model?: string; temperature?: number; max_tokens?: number; }
) {
  // Guard
  if (!mergedPayload) throw new Error('mergedPayload is required');

  // Call LLM adapter with retries
  const raw = await withRetries(() =>
    analyzeWithGroq({
      userId,
      mergedData: mergedPayload,
      healthDatabases,
      model: options?.model,
      temperature: options?.temperature,
      max_tokens: options?.max_tokens
    })
  );

  // Try to validate as v2
  const v2 = AnalysisV2.safeParse(raw);
  if (v2.success) {
    const analysis = v2.data;
    logger.info({ userId, model: analysis.model_version, preds: (analysis.projection?.predictions?.length || 0) }, 'analysis v2 ok');
    return analysis;
  }

  // Fallback: try legacy
  const legacy = LegacyAnalysis.safeParse(raw);
  if (legacy.success) {
    // convert legacy predictions to projection and baseline=empty (best-effort)
    const legacyData = legacy.data;
    const projection = { predictions: legacyData.predictions || [] };
    const out = {
      model_version: legacyData.model_version || 'unknown-legacy',
      generated_on: legacyData.generated_on || new Date().toISOString(),
      summary: legacyData.summary || '',
      baseline: { predictions: [] },
      projection,
      deltas: (legacyData.predictions || []).map((p: any) => ({
        condition: p.condition,
        baseline_pct: -1,
        projection_pct: p.probability_pct ?? p.probability ?? 0,
        delta_pct: -1
      })),
      explainability: legacyData.explainability || {}
    };
    logger.warn({ userId }, 'legacy analysis returned, converting to v2 shape');
    return out;
  }

  // No valid schema
  logger.error({ raw }, 'Invalid analysis schema from LLM');
  throw new Error('Invalid analysis returned from model');
}
