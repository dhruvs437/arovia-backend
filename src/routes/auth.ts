import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
const router = express.Router();

// dev: create a test user on first login if not exists
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ ok: false, error: 'username/password required' });

  let user = await User.findOne({ username });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({ username, passwordHash, displayName: username });
  }
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return res.status(401).json({ ok: false, error: 'invalid credentials' });

  const token = jwt.sign({ sub: user._id, username: user.username }, process.env.JWT_SECRET || 'changeme', { expiresIn: '30d' });
  res.json({ ok: true, token });
});

export default router;
