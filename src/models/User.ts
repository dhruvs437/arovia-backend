import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
  username: { type: String, unique: true },
  passwordHash: String,
  displayName: String,
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.model('User', UserSchema);
