import type express from 'express';

type Labels = Record<string, string | number | boolean>;

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, { count: number; sum: number; buckets: Map<number, number> }>();
const LATENCY_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 120];

const escapeLabel = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const labelKey = (labels: Labels = {}) => Object.entries(labels)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}="${escapeLabel(String(value))}"`)
  .join(',');
const metricKey = (name: string, labels: Labels = {}) => `${name}|${labelKey(labels)}`;

export const incrementMetric = (name: string, labels: Labels = {}, amount = 1) => {
  const key = metricKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + amount);
};

export const setMetricGauge = (name: string, value: number, labels: Labels = {}) => {
  gauges.set(metricKey(name, labels), value);
};

export const observeMetric = (name: string, valueSeconds: number, labels: Labels = {}) => {
  const key = metricKey(name, labels);
  const histogram = histograms.get(key) ?? {
    count: 0,
    sum: 0,
    buckets: new Map(LATENCY_BUCKETS.map((bucket) => [bucket, 0])),
  };
  histogram.count += 1;
  histogram.sum += valueSeconds;
  for (const bucket of LATENCY_BUCKETS) {
    if (valueSeconds <= bucket) histogram.buckets.set(bucket, (histogram.buckets.get(bucket) ?? 0) + 1);
  }
  histograms.set(key, histogram);
};

const splitMetricKey = (key: string) => {
  const separator = key.indexOf('|');
  return { name: key.slice(0, separator), labels: key.slice(separator + 1) };
};
const withLabels = (name: string, labels: string, extra = '') => {
  const combined = [labels, extra].filter(Boolean).join(',');
  return combined ? `${name}{${combined}}` : name;
};

export const renderMetrics = () => {
  const lines = [
    '# MixStil vendor-neutral Prometheus metrics',
    '# Counters reset when this API process restarts.',
  ];
  for (const [key, value] of counters) {
    const { name, labels } = splitMetricKey(key);
    lines.push(`${withLabels(name, labels)} ${value}`);
  }
  for (const [key, value] of gauges) {
    const { name, labels } = splitMetricKey(key);
    lines.push(`${withLabels(name, labels)} ${value}`);
  }
  for (const [key, histogram] of histograms) {
    const { name, labels } = splitMetricKey(key);
    for (const bucket of LATENCY_BUCKETS) {
      lines.push(`${withLabels(`${name}_bucket`, labels, `le="${bucket}"`)} ${histogram.buckets.get(bucket) ?? 0}`);
    }
    lines.push(`${withLabels(`${name}_bucket`, labels, 'le="+Inf"')} ${histogram.count}`);
    lines.push(`${withLabels(`${name}_sum`, labels)} ${histogram.sum}`);
    lines.push(`${withLabels(`${name}_count`, labels)} ${histogram.count}`);
  }
  return `${lines.join('\n')}\n`;
};

const safeRoute = (req: express.Request) => {
  const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
  if (routePath) return `${req.baseUrl || ''}${routePath}`;
  return req.path
    .replace(/\b[a-f0-9]{24,}\b/gi, ':id')
    .replace(/\b(?:mix|user|session|snd|pbe|req|ai|share)_[a-z0-9_-]+\b/gi, ':id')
    .replace(/\/[a-zA-Z0-9_-]{16,}(?=\/|$)/g, '/:id');
};

export const classifyError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/postgres|database|connection|timeout|econnrefused/.test(message)) return 'database';
  if (/storage|s3|bucket|object/.test(message)) return 'storage';
  if (/ffmpeg|ffprobe|render|audio/.test(message)) return 'media_processing';
  if (/ai|provider|classification/.test(message)) return 'generation';
  return 'internal';
};

export const logEvent = (level: 'info' | 'warn' | 'error', event: string, fields: Labels = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'snooze-api',
    event,
    ...fields,
  };
  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
};

export const requestObservability: express.RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const latencySeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const route = safeRoute(req);
    const labels = { method: req.method, route, status_class: `${Math.floor(res.statusCode / 100)}xx` };
    incrementMetric('snooze_http_requests_total', labels);
    observeMetric('snooze_http_request_duration_seconds', latencySeconds, { method: req.method, route });
    if (res.statusCode >= 500) incrementMetric('snooze_http_5xx_total', { method: req.method, route });
    logEvent(res.statusCode >= 500 ? 'error' : 'info', 'http_request', {
      request_id: String(res.locals.requestId ?? 'unknown'),
      method: req.method,
      route,
      status: res.statusCode,
      latency_ms: Math.round(latencySeconds * 1000),
    });
  });
  next();
};

export const observeOperation = async <T>(name: string, operation: () => Promise<T>) => {
  const startedAt = process.hrtime.bigint();
  try {
    const result = await operation();
    incrementMetric(`snooze_${name}_total`, { outcome: 'success' });
    return result;
  } catch (error) {
    incrementMetric(`snooze_${name}_total`, { outcome: 'failure', error_class: classifyError(error) });
    throw error;
  } finally {
    observeMetric(`snooze_${name}_duration_seconds`, Number(process.hrtime.bigint() - startedAt) / 1_000_000_000);
  }
};
