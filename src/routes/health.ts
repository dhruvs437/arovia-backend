import express from 'express';
import HealthRecord from '../models/HealthRecord';
const router = express.Router();

// POST /api/health
router.post('/', async (req: any, res) => {
  const { userId, source, payload } = req.body;
  if (!userId || !payload) return res.status(400).json({ ok: false, error: 'userId and payload required' });
  const doc = await HealthRecord.create({ userId, source, payload });
  res.json({ ok: true, id: doc._id });
});

// GET /api/health/:userId
router.get('/:userId', async (req, res) => {
  const docs = await HealthRecord.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(20);
  res.json({ ok: true, docs });
});

export default router;
