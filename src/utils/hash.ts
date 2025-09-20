import crypto from 'crypto';
export const inputHash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
