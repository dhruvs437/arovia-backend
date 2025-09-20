import express from 'express';
import HealthRecord from '../models/HealthRecord';
import { analyzeMerged } from '../services/analyzeService';
const router = express.Router();

// POST /api/analyze
router.post('/', async (req: any, res) => {
  const { userId, lifestyle } = req.body;
  if (!userId || !lifestyle) return res.status(400).json({ ok: false, error: 'userId and lifestyle required' });

  const latest = await HealthRecord.findOne({ userId }).sort({ createdAt: -1 });
  const merged = { payload: { ...(latest?.payload || {}), ...(lifestyle || {}) } };

  const analysis = await analyzeMerged(userId, merged);

  await HealthRecord.create({ userId, source: 'analysis', payload: analysis });

  res.json({ ok: true, analysis });
});

export default router;
