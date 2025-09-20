// src/models/HealthRecord.ts (patch)
import mongoose, { Schema } from 'mongoose';
const HealthRecordSchema = new Schema({
  userId: { type: String, index: true },
  source: String, // 'abha'|'app'|'analysis'
  payload: Schema.Types.Mixed,
  meta: Schema.Types.Mixed, // free-form metadata (audit info)
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.model('HealthRecord', HealthRecordSchema);
