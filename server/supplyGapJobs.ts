import { createHash, randomBytes } from 'node:crypto';
import { query } from './db';
import type { GenerationDecision } from './generationDecision';

export type SupplyGapJobStatus = 'queued' | 'running' | 'candidate_ready' | 'qa_failed' | 'approved' | 'failed' | 'blocked';

export type SupplyGapJob = {
  id: string;
  requestedByUserId: string;
  status: SupplyGapJobStatus;
  decisionKind: Exclude<GenerationDecision['kind'], 'inventory_only'>;
  role: string;
  providerPolicy: string;
  provider: string;
  specHash: string;
  prompt: string;
  goal: string;
  scene: string;
  contentMode: string;
  generationSpec: GenerationDecision['generationSpec'];
  missing: GenerationDecision['missing'];
  candidateCount: number;
  cacheHitCount: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  qaStatus: 'not_started' | 'machine_pending' | 'human_pending' | 'passed' | 'failed';
  failureReason: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplyGapCandidate = {
  id: string;
  jobId: string;
  candidateIndex: number;
  status: 'spec_ready' | 'machine_pending' | 'machine_failed' | 'human_pending' | 'approved' | 'rejected';
  provider: string;
  title: string;
  audioUrl: string;
  reviewUrl: string;
  originRecord: Record<string, unknown>;
  acousticReport: Record<string, unknown>;
  licenseRecord: Record<string, unknown>;
  costUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplyGapJobEnsureResult =
  | { status: 'not_needed'; decision: GenerationDecision; job: null; quota: SupplyGapQuota }
  | { status: 'cached' | 'created' | 'blocked'; decision: GenerationDecision; job: SupplyGapJob; quota: SupplyGapQuota };

export type SupplyGapQuota = {
  limit: number;
  used: number;
  remaining: number;
};

const uid = (prefix: string) => `${prefix}_${randomBytes(6).toString('hex')}`;

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
};

const hashDecision = (decision: GenerationDecision): string => createHash('sha256').update(stableJson({
  kind: decision.kind,
  goal: decision.goal,
  scene: decision.scene,
  contentMode: decision.contentMode,
  missing: decision.missing,
  generationSpec: decision.generationSpec,
  fullTrackProviderAllowed: decision.fullTrackProviderAllowed,
})).digest('hex');

const mapJob = (row: any): SupplyGapJob => ({
  id: row.id,
  requestedByUserId: row.requested_by_user_id,
  status: row.status,
  decisionKind: row.decision_kind,
  role: row.role,
  providerPolicy: row.provider_policy,
  provider: row.provider,
  specHash: row.spec_hash,
  prompt: row.prompt,
  goal: row.goal,
  scene: row.scene,
  contentMode: row.content_mode,
  generationSpec: row.generation_spec,
  missing: row.missing,
  candidateCount: Number(row.candidate_count),
  cacheHitCount: Number(row.cache_hit_count),
  estimatedCostUsd: Number(row.estimated_cost_usd),
  actualCostUsd: Number(row.actual_cost_usd),
  qaStatus: row.qa_status,
  failureReason: row.failure_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapCandidate = (row: any): SupplyGapCandidate => ({
  id: row.id,
  jobId: row.job_id,
  candidateIndex: Number(row.candidate_index),
  status: row.status,
  provider: row.provider,
  title: row.title,
  audioUrl: row.audio_url,
  reviewUrl: row.review_url,
  originRecord: row.origin_record,
  acousticReport: row.acoustic_report,
  licenseRecord: row.license_record,
  costUsd: Number(row.cost_usd),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const providerFor = (decision: GenerationDecision): string => {
  if (decision.kind === 'unsupported_multi_gap') return 'none_full_track_blocked';
  if (decision.generationSpec?.providerPolicy === 'local_musickit_factory_only') return 'local_musickit_factory';
  return 'approved_inventory_import_then_external_sfx_candidates';
};

const statusFor = (decision: GenerationDecision): SupplyGapJobStatus =>
  decision.kind === 'unsupported_multi_gap' ? 'blocked' : 'queued';

const estimateCost = (decision: GenerationDecision): number => {
  if (decision.kind === 'unsupported_multi_gap') return 0;
  if (decision.generationSpec?.providerPolicy === 'local_musickit_factory_only') return 0;
  return 0.08 * Math.max(1, decision.generationSpec?.candidateCount ?? 1);
};

export const getSupplyGapQuota = async (userId: string): Promise<SupplyGapQuota> => {
  const limit = Math.max(1, Number(process.env.SUPPLY_GAP_DAILY_JOB_LIMIT ?? 12));
  const result = await query<{ count: string }>(
    `select count(*)::text as count from supply_gap_jobs
     where requested_by_user_id=$1 and created_at > now() - interval '24 hours'`,
    [userId],
  );
  const used = Number(result.rows[0]?.count ?? 0);
  return { limit, used, remaining: Math.max(0, limit - used) };
};

export const ensureSupplyGapJob = async (input: {
  userId: string;
  decision: GenerationDecision;
  prompt: string;
}): Promise<SupplyGapJobEnsureResult> => {
  if (input.decision.kind === 'inventory_only') {
    return { status: 'not_needed', decision: input.decision, job: null, quota: await getSupplyGapQuota(input.userId) };
  }

  const specHash = hashDecision(input.decision);
  const existing = await query<any>(
    `update supply_gap_jobs
     set cache_hit_count=cache_hit_count+1, updated_at=now()
     where spec_hash=$1
     returning *`,
    [specHash],
  );
  if (existing.rows[0]) {
    const job = mapJob(existing.rows[0]);
    return { status: job.status === 'blocked' ? 'blocked' : 'cached', decision: input.decision, job, quota: await getSupplyGapQuota(input.userId) };
  }

  const quota = await getSupplyGapQuota(input.userId);
  if (quota.remaining <= 0) {
    throw new Error(`Supply gap daily job limit reached (${quota.limit}).`);
  }

  const row = await query<any>(
    `insert into supply_gap_jobs (
       id, requested_by_user_id, status, decision_kind, role, provider_policy, provider,
       spec_hash, prompt, goal, scene, content_mode, generation_spec, missing,
       candidate_count, estimated_cost_usd, qa_status, failure_reason
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17,$18)
     returning *`,
    [
      uid('sgj'),
      input.userId,
      statusFor(input.decision),
      input.decision.kind,
      input.decision.generationSpec?.role ?? input.decision.missing[0]?.role ?? '',
      input.decision.generationSpec?.providerPolicy ?? '',
      providerFor(input.decision),
      specHash,
      input.prompt,
      input.decision.goal,
      input.decision.scene,
      input.decision.contentMode,
      JSON.stringify(input.decision.generationSpec),
      JSON.stringify(input.decision.missing),
      input.decision.generationSpec?.candidateCount ?? 0,
      estimateCost(input.decision),
      'not_started',
      input.decision.kind === 'unsupported_multi_gap' ? input.decision.reason : '',
    ],
  );

  const job = mapJob(row.rows[0]);
  return { status: job.status === 'blocked' ? 'blocked' : 'created', decision: input.decision, job, quota: await getSupplyGapQuota(input.userId) };
};

export const getSupplyGapJob = async (jobId: string, userId: string): Promise<SupplyGapJob | null> => {
  const result = await query<any>('select * from supply_gap_jobs where id=$1 and requested_by_user_id=$2', [jobId, userId]);
  return result.rows[0] ? mapJob(result.rows[0]) : null;
};

export const getSupplyGapCandidates = async (jobId: string, userId: string): Promise<SupplyGapCandidate[]> => {
  const result = await query<any>(
    `select c.* from supply_gap_candidates c
     join supply_gap_jobs j on j.id=c.job_id
     where c.job_id=$1 and j.requested_by_user_id=$2
     order by c.candidate_index`,
    [jobId, userId],
  );
  return result.rows.map(mapCandidate);
};

const insertCandidates = async (input: {
  job: SupplyGapJob;
  candidates: Array<Omit<SupplyGapCandidate, 'id' | 'jobId' | 'createdAt' | 'updatedAt'>>;
}) => {
  const rows: SupplyGapCandidate[] = [];
  for (const candidate of input.candidates) {
    const result = await query<any>(
      `insert into supply_gap_candidates (
         id, job_id, candidate_index, status, provider, title, audio_url, review_url,
         origin_record, acoustic_report, license_record, cost_usd
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12)
       on conflict (job_id, candidate_index) do update set
         status=excluded.status,
         provider=excluded.provider,
         title=excluded.title,
         audio_url=excluded.audio_url,
         review_url=excluded.review_url,
         origin_record=excluded.origin_record,
         acoustic_report=excluded.acoustic_report,
         license_record=excluded.license_record,
         cost_usd=excluded.cost_usd,
         updated_at=now()
       returning *`,
      [
        uid('sgc'),
        input.job.id,
        candidate.candidateIndex,
        candidate.status,
        candidate.provider,
        candidate.title,
        candidate.audioUrl,
        candidate.reviewUrl,
        JSON.stringify(candidate.originRecord),
        JSON.stringify(candidate.acousticReport),
        JSON.stringify(candidate.licenseRecord),
        candidate.costUsd,
      ],
    );
    rows.push(mapCandidate(result.rows[0]));
  }
  return rows;
};

const buildLocalMusicKitCandidates = (job: SupplyGapJob): Array<Omit<SupplyGapCandidate, 'id' | 'jobId' | 'createdAt' | 'updatedAt'>> => {
  const spec = job.generationSpec;
  if (!spec) return [];
  const count = Math.max(1, Math.min(4, spec.candidateCount));
  return Array.from({ length: count }, (_, index) => ({
    candidateIndex: index + 1,
    status: 'spec_ready' as const,
    provider: 'local_musickit_factory',
    title: `Local MusicKit ${spec.role} candidate ${index + 1}`,
    audioUrl: '',
    reviewUrl: '',
    originRecord: {
      fullTrack: false,
      route: 'controlled_stem_factory',
      source: 'MixStil deterministic arrangement with pinned commercial-compatible source materials',
      expectedStemRole: spec.role,
      expectedDurationSeconds: spec.durationSeconds,
      loopRequired: spec.loopRequired,
      candidateOnly: true,
      promotionGate: 'technical QA, rights/origin review, human listening, and Recipe V2 combination QA are required before approval',
    },
    acousticReport: {
      status: 'machine_pending',
      targets: spec.acousticTargets,
      forbiddenConceptIds: spec.forbiddenConceptIds,
      phaseFit: spec.phaseFit,
    },
    licenseRecord: {
      paidApi: false,
      providerTermsRequired: false,
      commercialUseClaimedAtCandidateStage: false,
      notes: 'Candidate brief only; approval requires source and render artifact checks.',
    },
    costUsd: 0,
  }));
};

export const processSupplyGapJob = async (input: {
  userId: string;
  jobId: string;
}): Promise<{ job: SupplyGapJob; candidates: SupplyGapCandidate[]; fallback: string | null }> => {
  const job = await getSupplyGapJob(input.jobId, input.userId);
  if (!job) throw new Error('Supply gap job not found.');
  if (job.status === 'blocked') {
    return { job, candidates: await getSupplyGapCandidates(job.id, input.userId), fallback: 'multi_gap_blocked' };
  }
  if (!['queued', 'failed', 'qa_failed'].includes(job.status)) {
    return { job, candidates: await getSupplyGapCandidates(job.id, input.userId), fallback: null };
  }
  if (!job.generationSpec) throw new Error('Supply gap job does not contain a generation spec.');

  const maxCost = Math.max(0, Number(process.env.SUPPLY_GAP_MAX_JOB_COST_USD ?? 1));
  if (job.estimatedCostUsd > maxCost) {
    const updated = await query<any>(
      `update supply_gap_jobs
       set status='failed', qa_status='failed', failure_reason=$2, updated_at=now()
       where id=$1 returning *`,
      [job.id, `Estimated job cost ${job.estimatedCostUsd} exceeds configured max ${maxCost}.`],
    );
    return { job: mapJob(updated.rows[0]), candidates: [], fallback: 'cost_limit_exceeded' };
  }

  await query(`update supply_gap_jobs set status='running', updated_at=now() where id=$1`, [job.id]);

  if (job.providerPolicy === 'local_musickit_factory_only') {
    const candidates = await insertCandidates({ job, candidates: buildLocalMusicKitCandidates(job) });
    const updated = await query<any>(
      `update supply_gap_jobs
       set status='candidate_ready', qa_status='machine_pending', candidate_count=$2, actual_cost_usd=0, updated_at=now()
       where id=$1 returning *`,
      [job.id, candidates.length],
    );
    return { job: mapJob(updated.rows[0]), candidates, fallback: null };
  }

  const externalEnabled = process.env.SUPPLY_GAP_EXTERNAL_SFX_ENABLED === '1';
  if (!externalEnabled) {
    const updated = await query<any>(
      `update supply_gap_jobs
       set status='failed', qa_status='failed', failure_reason=$2, updated_at=now()
       where id=$1 returning *`,
      [job.id, 'External SFX provider is disabled; keep using approved inventory and record this as an unresolved supply gap.'],
    );
    return { job: mapJob(updated.rows[0]), candidates: [], fallback: 'external_provider_disabled' };
  }

  const updated = await query<any>(
    `update supply_gap_jobs
     set status='failed', qa_status='failed', failure_reason=$2, updated_at=now()
     where id=$1 returning *`,
    [job.id, 'External SFX adapter is configured but no production provider implementation is enabled.'],
  );
  return { job: mapJob(updated.rows[0]), candidates: [], fallback: 'external_adapter_not_implemented' };
};
