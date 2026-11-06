import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  db: {
    mode: process.env.DB_MODE || (process.env.DATABASE_URL ? 'postgres' : 'sqlite'),
    url: process.env.DATABASE_URL,
    sqlitePath: process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/brightloop.sqlite'),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'brightloop_access_fallback_secret_key_12345!',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'brightloop_refresh_fallback_secret_key_12345!',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '20', 10),
  },
};
