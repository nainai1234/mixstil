import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
let authToken = '';

const request = async (pathname: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(authToken ? { authorization: `Bearer ${authToken}` } : {}), ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body;
};

let mixId = '';
let validationUserId = '';
const validationId = Date.now();
const directJourneyId = `validation_direct_${validationId}`;
const adjustedJourneyId = `validation_adjusted_${validationId}`;
const failedJourneyId = `validation_failed_${validationId}`;
const validationCohort = `metrics_${validationId}`;

try {
  const guest = await request('/api/auth/guest', { method: 'POST' });
  authToken = String(guest.token ?? '');
  validationUserId = String(guest.user?.id ?? '');
  if (!authToken) throw new Error('Playback metrics validation guest session was not created.');
  const created = await request('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'gentle rain for sleep', durationSeconds: 300 }),
  });
  mixId = String(created.mix?.id ?? '');
  if (!mixId) throw new Error('Playback metrics validation did not create a mix.');

  const recorded = await request(`/api/mixes/${mixId}/playback-events`, {
    method: 'POST',
    body: JSON.stringify({
      journeyId: directJourneyId,
      events: [
        { type: 'quick_create_started', elapsedMs: 0, details: { source: 'validation', validationCohort } },
        { type: 'recipe_ready', elapsedMs: 30 },
        { type: 'playback_requested', elapsedMs: 45 },
        { type: 'playback_started', elapsedMs: 120 },
        { type: 'native_media_session_ready', elapsedMs: 121, details: { bridge: 'validation', validationCohort } },
        { type: 'playback_checkpoint', elapsedMs: 1_800_000, details: { checkpointSeconds: 1800, validationCohort } },
        { type: 'result_accepted', elapsedMs: 5000, details: { listenedSeconds: 4.8 } },
        { type: 'work_saved', elapsedMs: 5100 },
        { type: 'work_published', elapsedMs: 5200 },
      ],
    }),
  });
  if (recorded.recorded !== 9) throw new Error('Playback metrics endpoint did not record all direct-accept events.');

  const journeyEvidence = await request(`/api/playback-events/journeys/${directJourneyId}`);
  if (journeyEvidence.journeyId !== directJourneyId || journeyEvidence.events?.length !== 9) {
    throw new Error(`Playback journey evidence endpoint returned an incomplete journey: ${JSON.stringify(journeyEvidence)}`);
  }
  if (!journeyEvidence.events.some((event: any) => event.type === 'native_media_session_ready')
    || !journeyEvidence.events.some((event: any) => event.type === 'playback_checkpoint' && event.details?.checkpointSeconds === 1800)) {
    throw new Error('Playback journey evidence did not expose native readiness and the 30 minute checkpoint.');
  }

  const longCheckpoint = await query<{ elapsed_ms: number; details: { checkpointSeconds?: number } }>(
    `select elapsed_ms, details from playback_events
     where journey_id = $1 and event_type = 'playback_checkpoint'`,
    [directJourneyId],
  );
  if (longCheckpoint.rows[0]?.elapsed_ms !== 1_800_000 || longCheckpoint.rows[0]?.details?.checkpointSeconds !== 1800) {
    throw new Error(`30 minute playback checkpoint was not persisted: ${JSON.stringify(longCheckpoint.rows[0] ?? null)}`);
  }

  await request(`/api/mixes/${mixId}/playback-events`, {
    method: 'POST',
    body: JSON.stringify({
      journeyId: adjustedJourneyId,
      events: [
        { type: 'quick_create_started', elapsedMs: 0, details: { source: 'validation', validationCohort } },
        { type: 'recipe_ready', elapsedMs: 40 },
        { type: 'result_adjust_requested', elapsedMs: 1000, details: { kind: 'natural_language', instruction: 'less rain' } },
        { type: 'result_adjust_applied', elapsedMs: 1300 },
        { type: 'result_accepted', elapsedMs: 3000 },
        { type: 'work_saved', elapsedMs: 3200 },
      ],
    }),
  });

  await request(`/api/mixes/${mixId}/playback-events`, {
    method: 'POST',
    body: JSON.stringify({
      journeyId: failedJourneyId,
      events: [
        { type: 'quick_create_started', elapsedMs: 0, details: { source: 'validation', validationCohort } },
        { type: 'playback_requested', elapsedMs: 20 },
        { type: 'playback_failed', elapsedMs: 10020, details: { reason: 'validation_startup_timeout' } },
        { type: 'result_retry_requested', elapsedMs: 10500 },
        { type: 'result_adjust_requested', elapsedMs: 11000, details: { kind: 'volume' } },
        { type: 'result_adjust_failed', elapsedMs: 11100, details: { reason: 'validation_update_failed' } },
      ],
    }),
  });

  const publicSummary = await request('/api/playback-metrics/summary');
  if (publicSummary.journeys?.some((item: any) => item.journeyId === directJourneyId)) {
    throw new Error('Synthetic playback validation leaked into real product metrics.');
  }
  const summary = await request(`/api/playback-metrics/summary?includeSynthetic=1&cohort=${validationCohort}`);
  if (summary.totalJourneys !== 3 || summary.filters?.cohort !== validationCohort || !summary.filters?.includeSynthetic) {
    throw new Error(`Cohort filtering did not isolate the three validation journeys: ${JSON.stringify(summary.filters)}`);
  }
  const journey = summary.journeys?.find((item: any) => item.journeyId === directJourneyId);
  const adjustedJourney = summary.journeys?.find((item: any) => item.journeyId === adjustedJourneyId);
  const failedJourney = summary.journeys?.find((item: any) => item.journeyId === failedJourneyId);
  if (!journey || journey.recipeReadyMs !== 30 || journey.playbackStartedMs !== 120 || journey.failed) {
    throw new Error(`Playback metrics summary did not preserve the validation journey: ${JSON.stringify(journey)}`);
  }
  if (!journey.accepted || !journey.firstResultAccepted || summary.resultDecisions?.firstAcceptedJourneys < 1) {
    throw new Error('Playback metrics summary did not expose the first-result acceptance decision.');
  }
  if (!adjustedJourney?.saved || adjustedJourney.firstResultAccepted || adjustedJourney.firstDecision !== 'adjusted') {
    throw new Error(`Adjusted-then-saved journey was classified incorrectly: ${JSON.stringify(adjustedJourney)}`);
  }
  if (!failedJourney?.adjustmentFailed || failedJourney.firstDecision !== 'retried') {
    throw new Error(`Failed adjustment/retry journey was classified incorrectly: ${JSON.stringify(failedJourney)}`);
  }
  if (!summary.failureReasons?.some((item: any) => item.reason === 'validation_startup_timeout')) {
    throw new Error('Playback failure reasons were not aggregated.');
  }
  if (summary.retentionReadiness?.gates?.acceptedOrSaved?.target !== 40) {
    throw new Error(`Retention readiness did not expose the accepted-or-saved gate: ${JSON.stringify(summary.retentionReadiness)}`);
  }
  if (typeof summary.retentionReadiness?.account30Day?.playDays !== 'number') {
    throw new Error('Retention readiness did not expose 30 day replay evidence.');
  }
  if (typeof summary.retentionReadiness?.preferenceEvidence?.total !== 'number') {
    throw new Error('Retention readiness did not expose preference memory evidence.');
  }

  console.log(JSON.stringify({
    passed: true,
    directJourneyId,
    adjustedJourneyId,
    failedJourneyId,
    recipeReadyMs: journey.recipeReadyMs,
    aggregateRecipeReadyP50Ms: summary.timeToRecipeReadyMs?.p50 ?? null,
    playbackStartedMs: journey.playbackStartedMs,
    aggregateSuccessRate: summary.successRate,
    aggregateP50Ms: summary.timeToFirstPlaybackMs?.p50 ?? null,
    aggregateP95Ms: summary.timeToFirstPlaybackMs?.p95 ?? null,
    firstResultAcceptanceRate: summary.resultDecisions?.firstResultAcceptanceRate ?? null,
    adjustedThenSavedRate: summary.resultOutcomes?.adjustedThenSavedRate ?? null,
    paymentReadiness: summary.retentionReadiness?.paymentReadiness ?? null,
  }, null, 2));
} finally {
  if (mixId) await query('delete from mixes where id = $1', [mixId]);
  if (validationUserId) await query('delete from users where id = $1', [validationUserId]);
  await pool.end();
}
