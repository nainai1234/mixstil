import { pool, query } from './db.js';

type JourneyRow = {
  journey_id: string;
  mix_id: string;
  created_at: Date;
  request_details: Record<string, unknown> | null;
  recipe_details: Record<string, unknown> | null;
  adjustment_details: Array<Record<string, unknown>> | null;
  decision_events: string[] | null;
  accepted: boolean;
  adjust_requested: boolean;
  adjust_applied: boolean;
  adjust_failed: boolean;
  retry_requested: boolean;
  saved: boolean;
  published: boolean;
  share_created: boolean;
  playback_count: number;
};

const readArg = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() || null;
};

const cohortFilter = readArg('cohort');
const participantFilter = readArg('participant');
const sinceArg = readArg('since');
const untilArg = readArg('until');
const parseDate = (value: string | null, label: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid --${label} date: ${value}`);
  return date;
};
const since = parseDate(sinceArg, 'since');
const until = parseDate(untilArg, 'until');

const result = await query<JourneyRow>(
  `select journey_id,
    min(mix_id) as mix_id,
    min(created_at) as created_at,
    (array_agg(details order by elapsed_ms, created_at, id) filter (where event_type = 'quick_create_started'))[1] as request_details,
    (array_agg(details order by elapsed_ms, created_at, id) filter (where event_type = 'recipe_ready'))[1] as recipe_details,
    array_agg(details order by elapsed_ms, created_at, id) filter (
      where event_type = 'result_adjust_requested' and details ? 'instruction'
    ) as adjustment_details,
    array_agg(event_type order by elapsed_ms, created_at, id) filter (
      where event_type in ('result_accepted', 'result_adjust_requested', 'result_retry_requested')
    ) as decision_events,
    bool_or(event_type = 'result_accepted') as accepted,
    bool_or(event_type = 'result_adjust_requested') as adjust_requested,
    bool_or(event_type = 'result_adjust_applied') as adjust_applied,
    bool_or(event_type = 'result_adjust_failed') as adjust_failed,
    bool_or(event_type = 'result_retry_requested') as retry_requested,
    bool_or(event_type = 'work_saved') as saved,
    bool_or(event_type = 'work_published') as published,
    bool_or(event_type = 'share_created') as share_created,
    (select count(*)::int from user_history where user_history.mix_id = min(playback_events.mix_id) and duration_listened = 0) as playback_count
   from playback_events
   group by journey_id
   order by min(created_at) desc`,
);

const realJourneys = result.rows.filter((row) => {
  const source = String(row.request_details?.source ?? '');
  const cohort = String(row.request_details?.validationCohort ?? '');
  const participant = String(row.request_details?.validationParticipant ?? '');
  return source === 'ai_heal'
    && typeof row.request_details?.prompt === 'string'
    && (!cohortFilter || cohort === cohortFilter)
    && (!participantFilter || participant === participantFilter)
    && (!since || row.created_at >= since)
    && (!until || row.created_at < until);
});
const decided = realJourneys.filter((row) => row.accepted || row.adjust_requested || row.retry_requested);
const firstDecision = (row: JourneyRow) => row.decision_events?.[0] === 'result_accepted'
  ? 'accepted'
  : row.decision_events?.[0] === 'result_adjust_requested'
    ? 'adjusted'
    : row.decision_events?.[0] === 'result_retry_requested'
      ? 'retried'
      : 'pending';
const firstAccepted = decided.filter((row) => firstDecision(row) === 'accepted');
const adjusted = realJourneys.filter((row) => row.adjust_requested);
const countValues = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((counts, value) => {
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {})).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

const excludedSounds = realJourneys.flatMap((row) => {
  const value = row.recipe_details?.excludedSounds;
  return Array.isArray(value) ? value.map(String) : [];
});
const adjustments = realJourneys.flatMap((row) => (row.adjustment_details ?? []).map((detail) => String(detail.instruction ?? '')).filter(Boolean));
const modes = realJourneys.map((row) => String(row.recipe_details?.contentMode ?? 'unknown'));
const scenes = realJourneys.map((row) => String(row.recipe_details?.scene ?? 'unknown'));
const goals = realJourneys.map((row) => String(row.request_details?.goal ?? 'unknown'));
const participants = realJourneys
  .map((row) => String(row.request_details?.validationParticipant ?? ''))
  .filter(Boolean);
const uniqueParticipants = [...new Set(participants)];

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  filters: {
    cohort: cohortFilter,
    participant: participantFilter,
    since: since?.toISOString() ?? null,
    until: until?.toISOString() ?? null,
  },
  cohort: {
    participantCount: uniqueParticipants.length,
    totalRequests: realJourneys.length,
    decidedRequests: decided.length,
    accepted: decided.filter((row) => row.accepted).length,
    firstAccepted: firstAccepted.length,
    adjusted: decided.filter((row) => row.adjust_requested).length,
    retried: decided.filter((row) => row.retry_requested).length,
    saved: realJourneys.filter((row) => row.saved).length,
    published: realJourneys.filter((row) => row.published).length,
    shareCreated: realJourneys.filter((row) => row.share_created).length,
    replayed: realJourneys.filter((row) => row.playback_count >= 2).length,
    adjustedThenSaved: adjusted.filter((row) => row.saved).length,
    firstResultAcceptanceRate: decided.length === 0 ? null : Math.round((firstAccepted.length / decided.length) * 1000) / 10,
    adjustedThenSavedRate: adjusted.length === 0 ? null : Math.round((adjusted.filter((row) => row.saved).length / adjusted.length) * 1000) / 10,
  },
  frequentExclusions: countValues(excludedSounds),
  frequentAdjustments: countValues(adjustments),
  distributions: {
    goals: countValues(goals),
    scenes: countValues(scenes),
    contentModes: countValues(modes),
  },
  requests: realJourneys.map((row) => ({
    journeyId: row.journey_id,
    mixId: row.mix_id,
    participant: row.request_details?.validationParticipant ?? null,
    createdAt: row.created_at,
    request: row.request_details,
    recipe: row.recipe_details,
    decision: firstDecision(row),
    acceptedAfterAdjustment: row.accepted && firstDecision(row) === 'adjusted',
    saved: row.saved,
    published: row.published,
    shareCreated: row.share_created,
    playbackCount: row.playback_count,
    replayed: row.playback_count >= 2,
    adjustments: row.adjustment_details ?? [],
  })),
}, null, 2));

await pool.end();
