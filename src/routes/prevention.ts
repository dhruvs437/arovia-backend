import express from 'express';
import HealthRecord from '../models/HealthRecord';
const router = express.Router();

router.get('/:userId', async (req, res) => {
  const analysis = await HealthRecord.findOne({ userId: req.params.userId, source: 'analysis' }).sort({ createdAt: -1 });
  if (!analysis) return res.json({ ok: false, preventionPayload: null });
  res.json({ ok: true, preventionPayload: analysis.payload });
});

export default router;
