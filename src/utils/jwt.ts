import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authMiddleware = (req: Request & any, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'no token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme') as any;
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }
};
