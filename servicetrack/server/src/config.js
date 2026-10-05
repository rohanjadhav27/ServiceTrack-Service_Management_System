import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
export const config = {
  port: Number(process.env.PORT || 4000),
  mongo: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicetrack?replicaSet=rs0',
  secret: process.env.JWT_SECRET,
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  capacity: Math.max(1, Number(process.env.SLOT_CAPACITY) || 3),
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  workshopName: process.env.WORKSHOP_NAME || 'ServiceTrack Workshop',
  workshopAddress: process.env.WORKSHOP_ADDRESS || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || '',
  razorpayKey: process.env.RAZORPAY_KEY_ID || '',
  razorpaySecret: process.env.RAZORPAY_KEY_SECRET || '',
};
