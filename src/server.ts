import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import 'express-async-errors';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';
import analyzeRoutes from './routes/analyze';
import preventionRoutes from './routes/prevention';
import { authMiddleware } from './utils/jwt';

const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: "*",           // allow requests from any origin
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/health', authMiddleware, healthRoutes);
app.use('/api/analyze', authMiddleware, analyzeRoutes);
app.use('/api/prevention', authMiddleware, preventionRoutes);

// global err
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message || 'server error' });
});

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/arovia')
  .then(() => {
    console.log('Mongo connected');
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
  })
  .catch(err => {
    console.error('Mongo connection failed', err);
    process.exit(1);
  });
