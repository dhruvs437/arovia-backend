// src/routes/analyze.ts
import express from 'express';
import HealthRecord from '../models/HealthRecord';
import { analyzeMerged } from '../services/analyzeService';
import { z } from 'zod';
import { inputHash } from '../utils/hash';
import logger from '../utils/logger';
import { rateLimitMiddleware } from '../utils/rateLimiter';

const router = express.Router();

const analyzeSchema = z.object({
  userId: z.string().min(1),
  lifestyle: z.record(z.any()).optional().default({}),
  consentId: z.string().optional(),
  healthDatabases: z.array(z.string()).optional()
});

router.post('/', rateLimitMiddleware, async (req: any, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.errors });

  const { userId, lifestyle, consentId, healthDatabases } = parsed.data;

  // fetch recent health records (last 10)
  const docs = await HealthRecord.find({ userId }).sort({ createdAt: -1 }).limit(10);

  // Build merged payload: include both recentRecords and the incoming lifestyle
  const merged = {
    baselineRecords: docs.map(d => ({ source: d.source, payload: d.payload, createdAt: d.createdAt })),
    lifestyle,
  };

  // compute an input hash for auditability
  const ihash = inputHash(JSON.stringify(merged));

  try {
    const analysis = await analyzeMerged(userId, merged, healthDatabases);

    // save analysis with meta
    await HealthRecord.create({
      userId,
      source: 'analysis',
      payload: analysis,
      meta: {
        modelVersion: analysis.model_version,
        consentId: consentId || null,
        inputHash: ihash,
        openaiStored: process.env.OPENAI_STORE === 'true' ? true : false
      }
    });

    res.json({ ok: true, analysis });
  } catch (err: any) {
    logger.error({ err }, 'analyze error');
    res.status(500).json({ ok: false, error: err.message || 'analysis failed' });
  }
});

export default router;
