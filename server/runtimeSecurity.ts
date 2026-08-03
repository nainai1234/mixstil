import type express from 'express';

const DEFAULT_SHARE_SECRET = 'snooze-local-creator-preview-v1';
const NATIVE_APP_ORIGINS = new Set(['capacitor://localhost', 'http://localhost']);

export type RuntimeConfig = {
  production: boolean;
  port: number;
  trustProxy: boolean | number | string;
  corsAllowedOrigins: Set<string>;
  shareCreatorPreviewSecret: string;
  metricsBearerToken: string;
  monitoringUrls: {
    live: string;
    ready: string;
    metrics: string;
  };
};

const parseTrustProxy = (value: string | undefined): RuntimeConfig['trustProxy'] => {
  if (!value) return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

const parseOrigins = (value: string | undefined) => new Set(
  String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
);

const isLocalDatabaseUrl = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
  } catch {
    return true;
  }
};

export const getRuntimeConfig = (env: NodeJS.ProcessEnv = process.env): RuntimeConfig => {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? env.API_PORT ?? 8788);
  const shareCreatorPreviewSecret = env.SHARE_CREATOR_PREVIEW_SECRET
    ?? (production ? '' : DEFAULT_SHARE_SECRET);
  const metricsBearerToken = env.METRICS_BEARER_TOKEN ?? '';
  const monitoringUrls = {
    live: env.MONITORING_LIVE_URL ?? '',
    ready: env.MONITORING_READY_URL ?? '',
    metrics: env.MONITORING_METRICS_URL ?? '',
  };
  const corsAllowedOrigins = parseOrigins(env.CORS_ALLOWED_ORIGINS);
  const errors: string[] = [];

  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('API_PORT must be an integer between 1 and 65535.');
  if (production) {
    if (!env.DATABASE_URL || isLocalDatabaseUrl(env.DATABASE_URL)) {
      errors.push('DATABASE_URL must point to a non-local production PostgreSQL service.');
    }
    if (shareCreatorPreviewSecret.length < 32 || shareCreatorPreviewSecret === DEFAULT_SHARE_SECRET) {
      errors.push('SHARE_CREATOR_PREVIEW_SECRET must be a unique production secret of at least 32 characters.');
    }
    if (corsAllowedOrigins.size === 0) {
      errors.push('CORS_ALLOWED_ORIGINS must list the web and native origins allowed to call the API.');
    }
    if (metricsBearerToken.length < 32) {
      errors.push('METRICS_BEARER_TOKEN must be a unique production secret of at least 32 characters.');
    }
    for (const [name, url] of Object.entries(monitoringUrls)) {
      if (!/^https:\/\//.test(url)) errors.push(`MONITORING_${name.toUpperCase()}_URL must be the deployed HTTPS monitoring target.`);
    }
    for (const origin of corsAllowedOrigins) {
      if (!/^(https:\/\/|capacitor:\/\/localhost$|http:\/\/localhost$)/.test(origin)) {
        errors.push(`CORS_ALLOWED_ORIGINS contains an unsafe production origin: ${origin}`);
      }
    }
  }

  if (errors.length) throw new Error(`Invalid runtime configuration:\n- ${errors.join('\n- ')}`);
  return {
    production,
    port,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    corsAllowedOrigins,
    shareCreatorPreviewSecret,
    metricsBearerToken,
    monitoringUrls,
  };
};

export const createCorsOptions = (config: RuntimeConfig) => ({
  origin(origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const normalized = origin.replace(/\/$/, '');
    if (!config.production || config.corsAllowedOrigins.has(normalized) || NATIVE_APP_ORIGINS.has(normalized)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by the MixStil API.'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Confirm-Account-Deletion', 'X-Request-Id', 'X-SNOOZE-Internal-QA'],
  maxAge: 86400,
});

export const securityHeaders: express.RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

type RateLimitEntry = { count: number; resetsAt: number };

export const createRateLimiter = (input: {
  windowMs: number;
  limit: number;
  key?: (req: express.Request) => string;
}): express.RequestHandler => {
  const entries = new Map<string, RateLimitEntry>();
  let lastCleanup = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (now - lastCleanup > input.windowMs) {
      for (const [key, entry] of entries) {
        if (entry.resetsAt <= now) entries.delete(key);
      }
      lastCleanup = now;
    }
    const key = input.key?.(req) ?? req.ip ?? 'unknown';
    const current = entries.get(key);
    const entry = !current || current.resetsAt <= now
      ? { count: 1, resetsAt: now + input.windowMs }
      : { count: current.count + 1, resetsAt: current.resetsAt };
    entries.set(key, entry);
    res.setHeader('RateLimit-Limit', String(input.limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, input.limit - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetsAt / 1000)));
    if (entry.count > input.limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetsAt - now) / 1000))));
      res.status(429).json({ error: 'Too many requests. Please wait and try again.', code: 'rate_limit_exceeded' });
      return;
    }
    next();
  };
};

export const requestIdentityKey = (req: express.Request) => {
  const authorization = String(req.headers.authorization ?? '');
  const ip = req.ip ?? 'unknown';
  if (!authorization.startsWith('Bearer ')) return ip;
  return `${ip}:${authorization.slice(7, 23)}`;
};
