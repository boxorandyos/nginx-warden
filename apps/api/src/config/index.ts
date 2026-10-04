import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8088',
  'http://127.0.0.1:8088',
];

function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw == null || !raw.trim()) {
    return [...DEFAULT_CORS_ORIGINS];
  }
  const parsed = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_CORS_ORIGINS];
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  /** Bind address for HTTP server. Use 0.0.0.0 to accept LAN/private IPs (default). Set 127.0.0.1 to loopback-only. */
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '60m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  cors: {
    // Empty CORS_ORIGIN="" must not become [""] (truthy) or every browser Origin is denied
    // → OPTIONS 204 without ACAO → Axios "Network Error" with blank status.
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    sessionSecret: process.env.SESSION_SECRET!,
  },
  server: {
    trustProxy: process.env.TRUST_PROXY === 'true',
    jsonLimit: process.env.JSON_BODY_LIMIT || '1mb',
    urlEncodedLimit: process.env.URLENCODED_BODY_LIMIT || '1mb',
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '20000', 10),
    headersTimeoutMs: parseInt(process.env.HEADERS_TIMEOUT_MS || '15000', 10),
    keepAliveTimeoutMs: parseInt(process.env.KEEPALIVE_TIMEOUT_MS || '60000', 10),
  },
  
  twoFactor: {
    appName: process.env.TWO_FACTOR_APP_NAME || 'Nginx Warden',
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const isProductionLike = (process.env.NODE_ENV || '').toLowerCase() === 'production';
if (isProductionLike) {
  const secretChecks = [
    ['JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET || ''],
    ['JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET || ''],
    ['SESSION_SECRET', process.env.SESSION_SECRET || ''],
  ] as const;
  const disallowed = new Set([
    'changeme',
    'change-me',
    'change-me-access-secret',
    'change-me-refresh-secret',
    'change-this-password',
    'password',
    'admin',
    'secret',
  ]);
  for (const [key, value] of secretChecks) {
    const normalized = value.trim().toLowerCase();
    if (normalized.length < 24 || disallowed.has(normalized)) {
      throw new Error(`${key} is unsafe for production; use a strong unique secret`);
    }
  }
}
