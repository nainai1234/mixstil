import cors from 'cors';
import express from 'express';
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { pool, query } from './db';
import { classifyRecipeIntent, getAiRecipeStatus } from './aiRecipe';
import { defaultRecipes, goals, scenes, selectFoundationalElementRecipe, selectMusicKitCatalogRecipe, type CatalogRecipe, type ProductGoal, type ProductScene } from './contentCatalog';
import { getAtomicFoundationStems, getFoundationalEligibilityStems } from './atomicFoundationElementProduction';
import { buildFoundationalCompositionBundle } from './foundationalCompositionRouterV1';
import { selectComposerResultRenderPilot } from './composerResultRenderPilotV1';
import { getInternalBaselineStems, selectInternalBaselineRecipe, type InternalBaselineMatch, type SavedInternalBaselinePreference } from './internalBaselineCatalog';
import { createSchema } from './schema';
import { seedDatabase } from './seed';
import { createCatalogRecipeV2, upgradeRecipeToV2, type LanguagePreference, type ResolvedLanguage } from './recipeV2';
import { buildRecipeFilterComplex, planRecipeRenderTracks, resolveTrimmedSourceDuration, usesCrossfadeLoop } from './renderRecipeV2';
import { parseAudioIntentV2 } from './audioIntentV2';
import { decideGeneration, type GenerationDecision } from './generationDecision';
import { ensureSupplyGapJob, getSupplyGapCandidates, getSupplyGapJob, processSupplyGapJob } from './supplyGapJobs';
import { generateTts } from './ttsProvider';
import { generateLyriaMusic } from './lyriaProvider';
import { selectVoiceScript } from './voiceScripts';
import { validateVoiceQaInput, voiceQaStemUpdate, type VoiceQaDecision } from './voiceQa';
import { applyDeterministicRecipeEdit } from './recipeEdits';
import { planQuickCreateSoundscape, SupplyGapError, type PlannedAudioIntent } from './soundscapePlanner';
import { seedAudioKnowledgeV3 } from './audioKnowledgeV3';
import { seedAudioIntentGoldSetV3 } from './audioIntentGoldSetV3';
import { buildAttributionCredits } from './attributionCredits';
import { buildWorkAttributionSidecar, formatWorkAttributionSidecarText } from './workAttributionSidecar';
import { productCapabilities } from './productCapabilities';
import { buildDemandCoverage, buildDemandTypesFromDiscoverConfig, type DemandType } from './demandCoverage';
import { getUnifiedContentModelSummary, syncDiscoverPlacements } from './contentModel';
import { createCorsOptions, createRateLimiter, getRuntimeConfig, requestIdentityKey, securityHeaders } from './runtimeSecurity';
import { classifyError, incrementMetric, logEvent, observeMetric, observeOperation, renderMetrics, requestObservability, setMetricGauge } from './observability';
import { ExportStorage, getStorageConfig, validateStorageConfig } from './storage';
import { entitlementError, getBillingEntitlement, COMMUNITY_PREVIEW_SECONDS, FREE_MAX_SESSION_SECONDS, FREE_SAVED_SOUND_LIMIT } from './entitlements';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
const DISCOVER_CONFIG_PATH = path.join(PROJECT_ROOT, 'data', 'discover-feed-config.json');
const PRODUCTION_AUDIO_SMOKE_PATH = path.join(PUBLIC_DIR, 'audio', 'content-baseline', 'batch-015', 'sleep_024_restless_mind_downshift.mp3');
const ADMIN_IMPORT_ROOT = path.join(PUBLIC_DIR, 'audio', 'inbox', 'admin-import');
const runtimeConfig = getRuntimeConfig();
const storageConfig = getStorageConfig(process.env, PROJECT_ROOT);
validateStorageConfig(storageConfig, runtimeConfig.production);
const exportStorage = new ExportStorage(storageConfig);
const SHARE_CREATOR_PREVIEW_SECRET = runtimeConfig.shareCreatorPreviewSecret;
const DEFAULT_COVER = '/share-visuals/scene-sleep.jpg';
const PUBLISHED_READY_WHERE = "status = 'published' and published_version_id is not null and render_status = 'ready'";
const MIX_PUBLISHED_READY_WHERE = "m.status = 'published' and m.published_version_id is not null and m.render_status = 'ready'";
const MIX_DISCOVER_ELIGIBLE_WHERE = `${MIX_PUBLISHED_READY_WHERE} and not exists (
  select 1
  from jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) as discover_track
  join audio_stems discover_stem on discover_stem.id = discover_track->>'stemId'
  where coalesce(discover_track->>'isMuted', 'false') <> 'true'
    and coalesce((discover_track->>'volume')::numeric, 0) > 0
    and (
      discover_stem.qa_status <> 'approved'
      or discover_stem.file_sha256 = ''
      or discover_stem.commercial_use_allowed = false
      or discover_stem.derivative_use_allowed = false
      or discover_stem.category = 'Voice'
    )
)`;
const app = express();
app.set('trust proxy', runtimeConfig.trustProxy);

const supportedUiLanguages = new Set<ResolvedLanguage>(['zh', 'en', 'hi', 'es', 'ar', 'bn', 'pt', 'ru', 'ja', 'id', 'de', 'fr', 'ko', 'it', 'nl', 'zh-Hant', 'tr', 'pl', 'sv', 'th', 'vi', 'ms', 'he', 'da', 'no', 'fi']);
const googleOAuthClientIds = String(process.env.GOOGLE_OAUTH_CLIENT_IDS ?? '')
  .split(',').map((value) => value.trim()).filter(Boolean);
const appleSignInClientIds = String(process.env.APPLE_SIGN_IN_CLIENT_IDS ?? 'com.mixstil.soundscapes')
  .split(',').map((value) => value.trim()).filter(Boolean);
const googleOAuthClient = new OAuth2Client();
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const normalizeLanguagePreference = (value: unknown): LanguagePreference => {
  if (value === 'system') return 'system';
  return typeof value === 'string' && supportedUiLanguages.has(value as ResolvedLanguage) ? value as ResolvedLanguage : 'system';
};

const normalizeResolvedLanguage = (value: unknown): ResolvedLanguage =>
  typeof value === 'string' && supportedUiLanguages.has(value as ResolvedLanguage) ? value as ResolvedLanguage : 'zh';

app.disable('x-powered-by');
app.use(securityHeaders);
app.use((req, res, next) => {
  const requestId = String(req.header('x-request-id') ?? uid('req')).slice(0, 100);
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});
app.use(requestObservability);
app.use(cors(createCorsOptions(runtimeConfig)));
app.use(express.json({ limit: '1mb' }));
app.use('/api', createRateLimiter({ windowMs: 60_000, limit: 240, key: requestIdentityKey }));
app.use('/api/auth', createRateLimiter({ windowMs: 15 * 60_000, limit: 30 }));
app.use('/api/quick-create', createRateLimiter({ windowMs: 60_000, limit: 10, key: requestIdentityKey }));
app.use('/api/ai/sessions', createRateLimiter({ windowMs: 60_000, limit: 10, key: requestIdentityKey }));
app.use('/api/supply-gap-jobs', createRateLimiter({ windowMs: 60_000, limit: 10, key: requestIdentityKey }));
app.use('/api/music-generation', createRateLimiter({ windowMs: 60_000, limit: 5, key: requestIdentityKey }));
app.use('/audio', express.static(path.join(PUBLIC_DIR, 'audio')), async (req, res, next) => {
  if (storageConfig.driver !== 's3' || !['GET', 'HEAD'].includes(req.method)) return next();
  const upstreamUrl = `${storageConfig.publicBaseUrl}/audio${req.url}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: req.headers.range ? { range: req.headers.range } : undefined,
    });
    if (!upstream.ok && upstream.status !== 206) return next();
    for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'cache-control']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.status(upstream.status);
    if (req.method === 'HEAD' || !upstream.body) return res.end();
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch {
    next();
  }
});
if (storageConfig.driver === 'local') app.use(storageConfig.localPublicPath, express.static(storageConfig.localDirectory));

app.get('/api/product-capabilities', (_req, res) => {
  res.json(productCapabilities);
});

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

type DiscoverQuickAction = {
  label: string;
  prompt: string;
};

type DiscoverSectionConfig = {
  id: string;
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  prompt: string;
  keywords: string[];
  mixIds: string[];
  icon: string;
  limit: number;
};

type DiscoverFeedConfig = {
  version: number;
  heroLabel: string;
  tags: string[];
  quickActions: DiscoverQuickAction[];
  sections: DiscoverSectionConfig[];
};

type DiscoverGovernance = {
  releaseEligibleMixIds: string[];
  blockedBindings: Array<{ sectionId: string; mixId: string; reason: string }>;
  emptySections: Array<{ sectionId: string; title: string; reason: string }>;
};

const fallbackDiscoverConfig: DiscoverFeedConfig = {
  version: 1,
  heroLabel: '从这里开始',
  tags: ['#深度睡眠', '#专注', '#冥想', '#雨声', '#无人声'],
  quickActions: [
    { label: '睡前入睡', prompt: '生成一个柔和、没有突发声的睡前声景。' },
    { label: '夜醒回睡', prompt: '生成一个短时回睡声景，开始就要安稳舒适。' },
    { label: '深度专注', prompt: '生成一个稳定、低干扰、无人声的专注声景。' },
    { label: '不要人声', prompt: '生成一个只使用柔和已审核素材的无人声声景。' },
  ],
  sections: [],
};

const cleanDiscoverText = (value: unknown, fallback = '', maxLength = 240) => {
  const text = String(value ?? fallback).trim();
  return text.slice(0, maxLength);
};

const objectRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const normalizeDiscoverConfig = (value: unknown): DiscoverFeedConfig => {
  const raw = value && typeof value === 'object' ? value as Record<string, any> : {};
  const quickActions = Array.isArray(raw.quickActions)
    ? raw.quickActions.map((item: any) => ({
      label: cleanDiscoverText(item?.label, '', 36),
      prompt: cleanDiscoverText(item?.prompt, '', 260),
    })).filter((item: DiscoverQuickAction) => item.label && item.prompt).slice(0, 16)
    : fallbackDiscoverConfig.quickActions;
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((item: any) => ({
      id: cleanDiscoverText(item?.id, '', 64).replace(/[^a-z0-9_-]/gi, '-').toLowerCase(),
      enabled: item?.enabled !== false,
      eyebrow: cleanDiscoverText(item?.eyebrow, '', 40),
      title: cleanDiscoverText(item?.title, '', 72),
      description: cleanDiscoverText(item?.description, '', 240),
      prompt: cleanDiscoverText(item?.prompt, '', 280),
      keywords: Array.isArray(item?.keywords)
        ? item.keywords.map((keyword: unknown) => cleanDiscoverText(keyword, '', 36).toLowerCase()).filter(Boolean).slice(0, 16)
        : [],
      mixIds: Array.isArray(item?.mixIds)
        ? item.mixIds.map((mixId: unknown) => cleanDiscoverText(mixId, '', 80)).filter(Boolean).slice(0, 24)
        : [],
      icon: cleanDiscoverText(item?.icon, 'compass', 32),
      limit: Math.max(1, Math.min(12, Number(item?.limit) || 6)),
    })).filter((item: DiscoverSectionConfig) => item.id && item.title && item.prompt).slice(0, 24)
    : [];
  return {
    version: Number(raw.version) || fallbackDiscoverConfig.version,
    heroLabel: cleanDiscoverText(raw.heroLabel, fallbackDiscoverConfig.heroLabel, 40),
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag: unknown) => cleanDiscoverText(tag, '', 36)).filter(Boolean).slice(0, 16) : fallbackDiscoverConfig.tags,
    quickActions,
    sections,
  };
};

const loadDiscoverConfig = async () => {
  try {
    const contents = await readFile(DISCOVER_CONFIG_PATH, 'utf8');
    return normalizeDiscoverConfig(JSON.parse(contents));
  } catch {
    return fallbackDiscoverConfig;
  }
};

const mixSearchText = (mix: any) => `${mix.title ?? ''} ${mix.description ?? ''} ${JSON.stringify(mix.recipeData ?? {})}`.toLowerCase();

const buildDiscoverSections = (config: DiscoverFeedConfig, mixes: any[]) => config.sections
  .filter((section) => section.enabled)
  .map((section) => {
    const pinned = section.mixIds
      .map((mixId) => mixes.find((mix) => mix.id === mixId))
      .filter(Boolean)
      .slice(0, section.limit);
    const matches = pinned.length > 0
      ? pinned
      : mixes.filter((mix) => section.keywords.some((keyword) => mixSearchText(mix).includes(keyword))).slice(0, section.limit);
    return {
      id: section.id,
      eyebrow: section.eyebrow,
      title: section.title,
      description: section.description,
      prompt: section.prompt,
      icon: section.icon,
      mixIds: section.mixIds,
      mixes: matches,
    };
  });

const releaseBlockersForStemRow = (stem: any) => {
  const blockers: string[] = [];
  if (stem.qa_status !== 'approved') blockers.push(`asset qa is ${stem.qa_status}`);
  if (!stem.file_sha256) blockers.push('missing SHA-256');
  if (!stem.commercial_use_allowed) blockers.push('commercial use not confirmed');
  if (!stem.derivative_use_allowed) blockers.push('derivative mix use not confirmed');
  if (stem.category === 'Voice') blockers.push('Voice-free Beta excludes audible voice');
  return blockers;
};

const demandProductionReleaseBlockers = async (row: any) => {
  const recipe = row.recipe_data ?? {};
  const batch = recipe.audit?.demandProductionBatch ?? {};
  const blockers: string[] = [];
  if (batch.approvalState !== 'human_passed_release_candidate') blockers.push('human listening pass is required before release governance');
  if (row.status !== 'private') blockers.push(`candidate status must be private before governance, got ${row.status}`);
  if (row.render_status !== 'ready') blockers.push(`render status must be ready, got ${row.render_status}`);
  if (!row.rendered_audio_url) blockers.push('rendered audio URL is missing');
  if (!row.published_version_id) blockers.push('frozen published version is missing');
  if (recipe.versionState !== 'frozen') blockers.push('Recipe V2 version must be frozen');
  if (!row.qa_created_at || row.machine_passed !== true) blockers.push('latest machine render QA has not passed');
  const tracks = Array.isArray(recipe.tracks) ? recipe.tracks.filter((track: any) =>
    String(track?.stemId ?? '').trim()
    && String(track?.isMuted ?? 'false') !== 'true'
    && Number(track?.volume ?? 0) > 0,
  ) : [];
  if (tracks.length === 0) blockers.push('candidate has no audible approved tracks');
  const stemResult = await query<any>(
    `select s.*
     from jsonb_array_elements(coalesce($1::jsonb->'tracks', '[]'::jsonb)) as track
     join audio_stems s on s.id = track->>'stemId'
     where coalesce(track->>'isMuted', 'false') <> 'true'
       and coalesce((track->>'volume')::numeric, 0) > 0`,
    [JSON.stringify(recipe)],
  );
  const foundStemIds = new Set(stemResult.rows.map((stem: any) => stem.id));
  for (const track of tracks) {
    if (!foundStemIds.has(track.stemId)) blockers.push(`audible stem ${track.stemId} is missing from asset library`);
  }
  for (const stem of stemResult.rows) {
    for (const blocker of releaseBlockersForStemRow(stem)) {
      blockers.push(`${stem.id}: ${blocker}`);
    }
  }
  return Array.from(new Set(blockers));
};

const buildDiscoverGovernance = (config: DiscoverFeedConfig, releaseEligibleMixIds: string[]): DiscoverGovernance => {
  const eligible = new Set(releaseEligibleMixIds);
  const blockedBindings = config.sections.flatMap((section) =>
    section.mixIds
      .filter((mixId) => !eligible.has(mixId))
      .map((mixId) => ({ sectionId: section.id, mixId, reason: 'not published, rendered, and release eligible' })),
  );
  const emptySections = config.sections
    .filter((section) => section.enabled && section.mixIds.length === 0 && section.keywords.length === 0)
    .map((section) => ({ sectionId: section.id, title: section.title, reason: 'no pinned content or concept keywords' }));
  return { releaseEligibleMixIds, blockedBindings, emptySections };
};

const discoverDemandText = (...values: unknown[]) => values
  .flatMap((value) => Array.isArray(value) ? value : [value])
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

const discoverMixDemandTypeIds = (mix: any, demandTypes: DemandType[]) => {
  const recipe = mix.recipe_data ?? {};
  const audioIntent = recipe.audioIntent ?? {};
  const categories = Array.isArray(mix.track_categories) ? mix.track_categories : [];
  const haystack = discoverDemandText(
    mix.id,
    mix.title,
    mix.description,
    audioIntent.goal,
    audioIntent.scene,
    audioIntent.contentMode,
    recipe.contentMode,
    categories,
  );
  return demandTypes
    .filter((demand) => {
      const directIntentMatch = audioIntent.goal === demand.goal && audioIntent.scene === demand.scene;
      const keywordMatch = demand.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
        || haystack.includes(demand.id.toLowerCase());
      return directIntentMatch || keywordMatch;
    })
    .map((demand) => demand.id);
};

const buildDiscoverDemandPools = (config: DiscoverFeedConfig, availableMixRows: any[]) => {
  const demandTypes = buildDemandTypesFromDiscoverConfig(config);
  const mixDemandTypeIds = new Map<string, string[]>();
  for (const row of availableMixRows) {
    const matched = discoverMixDemandTypeIds(row, demandTypes);
    mixDemandTypeIds.set(row.id, matched);
  }
  return demandTypes.map((demand) => {
    const mixes = availableMixRows
      .filter((row) => mixDemandTypeIds.get(row.id)?.includes(demand.id))
      .map((row) => ({
        id: row.id,
        title: row.title,
        goal: row.recipe_data?.audioIntent?.goal ?? '',
        scene: row.recipe_data?.audioIntent?.scene ?? '',
        contentMode: row.recipe_data?.audioIntent?.contentMode ?? row.recipe_data?.contentMode ?? '',
        playsCount: Number(row.plays_count ?? 0),
        trackCategories: Array.isArray(row.track_categories) ? row.track_categories : [],
      }));
    return {
      id: demand.id,
      title: demand.title,
      description: demand.description,
      prompt: demand.prompt,
      keywords: demand.keywords,
      goal: demand.goal,
      scene: demand.scene,
      contentMode: demand.contentMode,
      freeTargetCount: demand.freeTargetCount,
      paidTargetCount: demand.paidTargetCount,
      eligibleMixCount: mixes.length,
      eligibleMixIds: mixes.map((mix) => mix.id),
      mixes,
    };
  });
};

const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const createShareCreatorPreviewToken = (row: any) => createHmac('sha256', SHARE_CREATOR_PREVIEW_SECRET)
  .update(`${row.id}:${row.slug}:${row.creator_id}`)
  .digest('hex');
const hasValidShareCreatorPreviewToken = (req: express.Request, row: any) => {
  const supplied = String(req.query.creatorPreviewToken ?? '');
  if (!supplied) return false;
  const expected = createShareCreatorPreviewToken(row);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
};
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
};
const verifyPassword = (password: string, stored: string) => {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const createAuthSession = async (userId: string) => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(
    'insert into auth_sessions (id, token_hash, user_id, expires_at) values ($1, $2, $3, $4)',
    [uid('session'), hashToken(token), userId, expiresAt],
  );
  return { token, expiresAt: expiresAt.toISOString() };
};
const getAuthenticatedUser = async (req: express.Request) => {
  const authorization = String(req.headers.authorization ?? '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;
  const result = await query<any>(
    `select u.* from auth_sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
};
const isGuestUser = (user: any) => Boolean(
  user
  && !user.password_hash
  && String(user.email ?? '').endsWith('@snooze.invalid'),
);
const mergeGuestIntoAccount = async (client: any, guestUserId: string, accountUserId: string) => {
  if (guestUserId === accountUserId) return;
  await client.query(
    `insert into user_sound_profiles (
       user_id, liked_sounds, excluded_sounds, default_goal, default_duration_seconds, sensitivity, updated_at
     )
     select $2, liked_sounds, excluded_sounds, default_goal, default_duration_seconds, sensitivity, updated_at
     from user_sound_profiles where user_id = $1
     on conflict (user_id) do update set
       liked_sounds = array(select distinct unnest(user_sound_profiles.liked_sounds || excluded.liked_sounds)),
       excluded_sounds = array(select distinct unnest(user_sound_profiles.excluded_sounds || excluded.excluded_sounds)),
       sensitivity = excluded.sensitivity || user_sound_profiles.sensitivity,
       updated_at = greatest(user_sound_profiles.updated_at, excluded.updated_at)`,
    [guestUserId, accountUserId],
  );
  await client.query('delete from user_sound_profiles where user_id = $1', [guestUserId]);
  await client.query(
    `insert into device_playback_states (user_id, mix_id, position_seconds, duration_seconds, updated_at)
     select $2, mix_id, position_seconds, duration_seconds, updated_at
     from device_playback_states where user_id = $1
     on conflict (user_id, mix_id) do update set
       position_seconds = case when excluded.updated_at > device_playback_states.updated_at then excluded.position_seconds else device_playback_states.position_seconds end,
       duration_seconds = greatest(device_playback_states.duration_seconds, excluded.duration_seconds),
       updated_at = greatest(device_playback_states.updated_at, excluded.updated_at)`,
    [guestUserId, accountUserId],
  );
  await client.query('delete from device_playback_states where user_id = $1', [guestUserId]);
  for (const [table, column] of [
    ['preference_evidence', 'user_id'],
    ['asset_upload_sessions', 'user_id'],
    ['mixes', 'creator_id'],
    ['share_links', 'creator_id'],
    ['supply_gap_jobs', 'requested_by_user_id'],
    ['voice_qa_reviews', 'reviewer_id'],
    ['user_history', 'user_id'],
    ['playback_events', 'user_id'],
    ['ai_sessions', 'user_id'],
  ] as const) {
    await client.query(`update ${table} set ${column} = $2 where ${column} = $1`, [guestUserId, accountUserId]);
  }
  await client.query('update share_links set recipient_user_id = $2 where recipient_user_id = $1', [guestUserId, accountUserId]);
  await client.query('delete from users where id = $1', [guestUserId]);
};

type VerifiedSocialIdentity = {
  provider: 'apple' | 'google';
  subject: string;
  email: string;
  name: string;
  avatarUrl: string;
};

const verifySocialIdentity = async (provider: 'apple' | 'google', idToken: string, suppliedName: string): Promise<VerifiedSocialIdentity> => {
  if (!idToken) throw Object.assign(new Error('The identity provider did not return a valid sign-in token.'), { statusCode: 401 });
  if (provider === 'google') {
    if (googleOAuthClientIds.length === 0) throw Object.assign(new Error('Google sign-in is not configured on this server.'), { statusCode: 503 });
    const ticket = await googleOAuthClient.verifyIdToken({ idToken, audience: googleOAuthClientIds });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw Object.assign(new Error('Google did not verify an email address for this account.'), { statusCode: 401 });
    }
    return {
      provider,
      subject: payload.sub,
      email: normalizeEmail(payload.email),
      name: String(payload.name ?? suppliedName ?? '').trim().slice(0, 60),
      avatarUrl: String(payload.picture ?? '').slice(0, 1000),
    };
  }
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience: appleSignInClientIds,
  });
  if (!payload.sub) throw Object.assign(new Error('Apple did not return an account identifier.'), { statusCode: 401 });
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  const email = typeof payload.email === 'string' && emailVerified ? normalizeEmail(payload.email) : '';
  return {
    provider,
    subject: payload.sub,
    email,
    name: suppliedName.trim().slice(0, 60),
    avatarUrl: '',
  };
};

const signInWithSocialIdentity = async (req: express.Request, identity: VerifiedSocialIdentity) => {
  const currentUser = await getAuthenticatedUser(req);
  const currentGuest = isGuestUser(currentUser) ? currentUser : null;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const linked = await client.query<any>(
      `select u.* from auth_identities i join users u on u.id = i.user_id
       where i.provider = $1 and i.provider_subject = $2 for update`,
      [identity.provider, identity.subject],
    );
    const emailAccount = !linked.rows[0] && identity.email
      ? await client.query<any>('select * from users where lower(email) = $1 for update', [identity.email])
      : { rows: [] };
    let user = linked.rows[0] ?? emailAccount.rows[0] ?? currentGuest;
    if (!user) {
      const userId = uid('user');
      const privateEmail = `${identity.provider}+${createHash('sha256').update(identity.subject).digest('hex').slice(0, 24)}@private.mixstil.invalid`;
      const created = await client.query<any>(
        `insert into users (id, username, email, avatar_url, role, subscription_tier, password_hash)
         values ($1, $2, $3, $4, 'consumer', 'free', '') returning *`,
        [userId, identity.name || (identity.provider === 'apple' ? 'Apple user' : 'Google user'), identity.email || privateEmail, identity.avatarUrl],
      );
      user = created.rows[0];
    } else if (currentGuest && user.id !== currentGuest.id) {
      await mergeGuestIntoAccount(client, currentGuest.id, user.id);
    } else if (currentGuest && user.id === currentGuest.id) {
      const privateEmail = `${identity.provider}+${createHash('sha256').update(identity.subject).digest('hex').slice(0, 24)}@private.mixstil.invalid`;
      const upgraded = await client.query<any>(
        `update users set username = $2, email = $3, avatar_url = $4, updated_at = now()
         where id = $1 returning *`,
        [user.id, identity.name || (identity.provider === 'apple' ? 'Apple user' : 'Google user'), identity.email || privateEmail, identity.avatarUrl],
      );
      user = upgraded.rows[0];
    }
    await client.query(
      `insert into auth_identities (provider, provider_subject, user_id, email)
       values ($1, $2, $3, $4)
       on conflict (provider, provider_subject) do update set email = excluded.email, updated_at = now()`,
      [identity.provider, identity.subject, user.id, identity.email],
    );
    await client.query('commit');
    return user;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};
const requireAuthenticatedUser = async (req: express.Request, res: express.Response) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in or continue as a guest to use this feature.', code: 'authentication_required' });
    return null;
  }
  return user;
};
const requireAdminUser = async (req: express.Request, res: express.Response) => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access is required.', code: 'admin_required' });
    return null;
  }
  return user;
};
const requireOwnedMix = async (req: express.Request, res: express.Response) => {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return null;
  const mix = await getMixById(String(req.params.id));
  if (!mix) {
    res.status(404).json({ error: 'Mix not found' });
    return null;
  }
  if (mix.creatorId !== user.id) {
    res.status(403).json({ error: 'You can only access your own mixes.' });
    return null;
  }
  return { user, mix };
};
const enforcePrivateShareAccess = async (req: express.Request, res: express.Response, row: any) => {
  if (row.visibility === 'public') return true;
  if (hasValidShareCreatorPreviewToken(req, row)) return true;
  const preview = {
    title: row.title_snapshot,
    creatorName: row.creator_name_snapshot,
    coverImageUrl: row.cover_snapshot || DEFAULT_COVER,
  };
  const viewer = await getAuthenticatedUser(req);
  if (!viewer) {
    if (row.recipient_user_id) {
      res.status(403).json({
        error: 'This private sound has already been claimed by another account.',
        code: 'private_share_already_claimed',
        preview,
      });
    } else {
      res.status(401).json({
        error: 'Register or log in to claim this private sound.',
        code: 'private_share_login_required',
        preview,
      });
    }
    return false;
  }
  let recipientUserId = row.recipient_user_id as string | null;
  if (!recipientUserId) {
    const claimed = await query<any>(
      `update share_links set recipient_user_id = $1
       where id = $2 and recipient_user_id is null
       returning recipient_user_id`,
      [viewer.id, row.id],
    );
    recipientUserId = claimed.rows[0]?.recipient_user_id ?? null;
    if (!recipientUserId) {
      const current = await query<any>('select recipient_user_id from share_links where id = $1', [row.id]);
      recipientUserId = current.rows[0]?.recipient_user_id ?? null;
    }
  }
  if (recipientUserId !== viewer.id) {
    res.status(403).json({
      error: 'This private sound has already been claimed by another account.',
      code: 'private_share_already_claimed',
      preview,
    });
    return false;
  }
  row.recipient_user_id = recipientUserId;
  return true;
};

const rejectVoiceWhenDisabled = (res: express.Response) => {
  if (productCapabilities.guidedVoice) return false;
  res.status(409).json({
    error: 'Guided voice is not available in the voice-free beta.',
    code: 'guided_voice_disabled',
    fallback: 'voice_off',
  });
  return true;
};

const mapUser = (row: any) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  avatarUrl: row.avatar_url,
  role: row.role,
  subscriptionTier: row.subscription_tier,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getPlaybackPolicy = async (req: express.Request, mix: any) => {
  const viewer = await getAuthenticatedUser(req);
  if (!viewer) {
    return { maxSessionSeconds: COMMUNITY_PREVIEW_SECONDS, isPreview: true };
  }
  const internalMobilePlaybackQa = !runtimeConfig.production
    && req.header('x-snooze-internal-qa') === 'mobile-playback';
  if (internalMobilePlaybackQa && viewer.id === mix.creatorId) {
    return { maxSessionSeconds: null, isPreview: false };
  }
  const entitlement = await getBillingEntitlement(viewer.id, viewer.subscription_tier);
  if (viewer.id === mix.creatorId || entitlement.tier === 'pro') {
    return { maxSessionSeconds: entitlement.playback.maxSessionSeconds, isPreview: false };
  }
  return { maxSessionSeconds: entitlement.playback.communityPreviewSeconds, isPreview: true };
};

const soundLabels = new Set(['rain', 'ocean', 'water', 'nature', 'forest', 'fire', 'wind', 'birds', 'crickets', 'train', 'indoor', 'chime', 'thunder', 'music', 'voice', 'noise']);
const normalizeSoundList = (value: unknown) => {
  const items = Array.isArray(value) ? value : [];
  return [...new Set(items.map((item) => String(item).trim().toLowerCase()).filter((item) => soundLabels.has(item)))].slice(0, 24);
};

const normalizeDefaultGoal = (value: unknown): ProductGoal => (
  value === 'sleep' || value === 'calm' || value === 'focus' ? value : 'sleep'
);

const normalizeDefaultDuration = (value: unknown) =>
  Math.max(300, Math.min(7200, Math.round(Number(value) || 900)));

const coverForIntent = (goal: string, scene = '') => {
  const intent = `${goal} ${scene}`.toLowerCase();
  if (/night.?wak|return.?to.?sleep|back.?to.?sleep/.test(intent)) return '/share-visuals/scene-return-to-sleep.png';
  if (/mask|noise|neighbor|city/.test(intent)) return '/share-visuals/scene-noise-masking.png';
  if (/minimal|low.?stim|strict|simple/.test(intent)) return '/share-visuals/scene-low-stimulation.png';
  if (/short|reset|transition/.test(intent)) return '/share-visuals/scene-short-reset.png';
  if (/forest/.test(intent)) return '/share-visuals/scene-midnight-forest.png';
  if (/ocean/.test(intent)) return '/share-visuals/scene-ocean-calm.png';
  if (goal === 'focus') return '/share-visuals/scene-deep-focus.png';
  if (goal === 'calm' || goal === 'meditation' || goal === 'emotional_settling') return '/share-visuals/scene-calm.jpg';
  if (goal === 'sleep') return '/share-visuals/scene-bedtime.png';
  return DEFAULT_COVER;
};

const mapSoundProfile = (row: any) => ({
  userId: row.user_id,
  likedSounds: row.liked_sounds ?? [],
  excludedSounds: row.excluded_sounds ?? [],
  defaultGoal: row.default_goal,
  defaultDurationSeconds: row.default_duration_seconds,
  sensitivity: row.sensitivity ?? {},
  updatedAt: row.updated_at,
});

const mapPreferenceEvidence = (row: any) => ({
  id: row.id,
  kind: row.kind,
  value: row.value,
  source: row.source,
  stable: row.stable,
  mixId: row.mix_id ?? null,
  details: row.details ?? {},
  createdAt: row.created_at,
});

const ensureSoundProfile = async (userId: string) => {
  const result = await query<any>(
    `insert into user_sound_profiles (user_id)
     values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning *`,
    [userId],
  );
  return result.rows[0];
};

const getSoundProfilePayload = async (userId: string) => {
  const profileRow = await ensureSoundProfile(userId);
  const evidence = await query<any>(
    `select * from preference_evidence where user_id = $1 order by created_at desc limit 50`,
    [userId],
  );
  return {
    profile: mapSoundProfile(profileRow),
    evidence: evidence.rows.map(mapPreferenceEvidence),
  };
};

const normalizeInternalBaselineMatch = (value: unknown): InternalBaselineMatch | null => {
  if (!value || typeof value !== 'object') return null;
  const match = value as Partial<InternalBaselineMatch>;
  if (
    typeof match.seedId !== 'string'
    || typeof match.title !== 'string'
    || (match.goal !== 'sleep' && match.goal !== 'calm' && match.goal !== 'focus')
    || typeof match.scene !== 'string'
    || !['bedtime', 'return_to_sleep', 'breathing', 'emotional_settling', 'deep_focus'].includes(String(match.canonicalScene ?? ''))
    || match.ownerListeningVerdict !== 'save_and_replay_worthy'
  ) return null;
  return {
    seedId: match.seedId,
    title: match.title,
    goal: match.goal,
    scene: match.scene,
    canonicalScene: match.canonicalScene as ProductScene,
    matchedSignals: Array.isArray(match.matchedSignals) ? match.matchedSignals.map(String).slice(0, 8) : [],
    matchReason: typeof match.matchReason === 'string' ? match.matchReason : '',
    ownerListeningVerdict: 'save_and_replay_worthy',
  };
};

const getSavedInternalBaselinePreferences = async (userId: string): Promise<SavedInternalBaselinePreference[]> => {
  const result = await query<any>(
    `select details, count(*)::int as saved_count, max(created_at) as latest_at
     from preference_evidence
     where user_id = $1
       and source = 'saved_sound'
       and kind = 'like'
       and stable = true
       and value like 'internal_baseline:%'
     group by details
     order by max(created_at) desc
     limit 12`,
    [userId],
  );
  return result.rows.flatMap((row) => {
    const match = normalizeInternalBaselineMatch(row.details?.internalBaselineMatch);
    if (!match) return [];
    return [{
      seedId: match.seedId,
      goal: match.goal,
      scene: match.scene,
      canonicalScene: match.canonicalScene,
      savedCount: Number(row.saved_count ?? 1),
    }];
  });
};

const recordSavedInternalBaselinePreference = async (userId: string, mixId: string, recipeData: unknown) => {
  const recipe = recipeData && typeof recipeData === 'object' ? recipeData as { quickCreate?: { internalBaselineMatch?: unknown } } : null;
  const match = normalizeInternalBaselineMatch(recipe?.quickCreate?.internalBaselineMatch);
  if (!match) return;
  await query(
    `insert into preference_evidence (id, user_id, kind, value, source, stable, mix_id, details)
     select $1, $2, 'like', $3, 'saved_sound', true, $4, $5::jsonb
     where not exists (
       select 1 from preference_evidence
       where user_id = $2 and source = 'saved_sound' and kind = 'like' and mix_id = $4 and value = $3
     )`,
    [
      uid('pref'),
      userId,
      `internal_baseline:${match.seedId}`,
      mixId,
      JSON.stringify({
        internalBaselineMatch: match,
        preferenceMeaning: 'User saved this owner-approved baseline to My Sounds; use as a stable positive signal for similar future creation.',
      }),
    ],
  );
};

const FIT_FEEDBACK_VALUES = new Set(['fits_me', 'too_loud', 'too_bright', 'too_plain', 'do_not_use']);

const evidenceForFitFeedback = (feedback: string, recipeData: unknown) => {
  const recipe = recipeData && typeof recipeData === 'object' ? recipeData as { quickCreate?: { internalBaselineMatch?: unknown } } : null;
  const match = normalizeInternalBaselineMatch(recipe?.quickCreate?.internalBaselineMatch);
  if (feedback === 'fits_me') {
    return {
      kind: 'like',
      value: match ? `internal_baseline:${match.seedId}` : 'soundscape_fit',
      stable: false,
      details: { internalBaselineMatch: match, feedbackMeaning: 'User said this result fit the current need.' },
    };
  }
  if (feedback === 'do_not_use') {
    return {
      kind: 'exclusion',
      value: match ? `internal_baseline:${match.seedId}` : 'soundscape_rejected',
      stable: true,
      details: { internalBaselineMatch: match, feedbackMeaning: 'User explicitly asked not to use this sound again.' },
    };
  }
  return {
    kind: 'sensitivity',
    value: feedback,
    stable: false,
    details: { internalBaselineMatch: match, feedbackMeaning: 'User gave one-session fit feedback for this sound.' },
  };
};

const mapStem = (row: any) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  audioUrl: row.audio_url,
  isPremium: row.is_premium,
  tags: row.tags ?? [],
  defaultVolume: row.default_volume,
  description: row.description,
  sourcePlatform: row.source_platform,
  sourceUrl: row.source_url,
  sourceItemId: row.source_item_id,
  sourceCreator: row.source_creator,
  licenseName: row.license_name,
  licenseUrl: row.license_url,
  commercialUseAllowed: row.commercial_use_allowed,
  derivativeUseAllowed: row.derivative_use_allowed,
  attributionRequired: row.attribution_required,
  rawRedistributionAllowed: row.raw_redistribution_allowed,
  qaStatus: row.qa_status,
  qaNotes: row.qa_notes,
  fileSha256: row.file_sha256,
  importedAt: row.imported_at,
});

const allowedUploadCategories = new Set(['Nature', 'Music', 'Noise', 'Voice', 'Accent']);
const allowedAudioUploadExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);
const adminImportFolderPlan = [
  '01_sleep/rain',
  '01_sleep/ocean_waves',
  '01_sleep/stream_water',
  '01_sleep/forest_night',
  '01_sleep/crickets_insects',
  '01_sleep/wind_soft',
  '01_sleep/fire_crackle',
  '01_sleep/brown_noise',
  '01_sleep/soft_drone_music',
  '02_calm/gentle_water',
  '02_calm/forest_morning',
  '02_calm/singing_bowl',
  '02_calm/chimes',
  '02_calm/soft_ambient_music',
  '02_calm/asmr_no_voice/brushing',
  '02_calm/asmr_no_voice/tapping',
  '02_calm/asmr_no_voice/paper',
  '02_calm/asmr_no_voice/fabric',
  '03_focus/steady_rain',
  '03_focus/fan_noise',
  '03_focus/pink_noise',
  '03_focus/room_tone',
  '03_focus/keyboard_soft',
  '03_focus/low_pulse_music',
  '04_accent/bell',
  '04_accent/bowl',
  '04_accent/soft_transition',
  '04_accent/tiny_texture',
  '90_voice_quarantine/whisper',
  '90_voice_quarantine/guided_voice',
  '90_voice_quarantine/spoken',
];

const adminImportManifestTemplate = [
  'filename,source_platform,source_url,creator,license_name,license_url,commercial_use_allowed,derivative_use_allowed,notes',
  'rain01.wav,自有录制,,Pang,Owned,,true,true,夜晚稳定雨声',
].join('\n');

const safeAssetSlug = (value: string) => String(value || 'asset')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase()
  .slice(0, 72) || 'asset';

const titleCaseAssetName = (value: string) => String(value || 'Untitled audio')
  .replace(/\.[^.]+$/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase())
  .slice(0, 140) || 'Untitled audio';

const hasAnyKeyword = (value: string, keywords: string[]) => keywords.some((keyword) => value.includes(keyword));

const contentTypeForAudioExt = (ext: string) => ({
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
}[ext] ?? 'application/octet-stream');

const hashFileSha256 = (filePath: string) => new Promise<string>((resolve, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(hash.digest('hex')));
});

const ensureAdminImportFolders = async () => {
  await mkdir(ADMIN_IMPORT_ROOT, { recursive: true });
  await Promise.all(adminImportFolderPlan.map((folder) => mkdir(path.join(ADMIN_IMPORT_ROOT, folder), { recursive: true })));
  const templatePath = path.join(ADMIN_IMPORT_ROOT, '_manifest_template.csv');
  if (!existsSync(templatePath)) {
    await writeFile(templatePath, `${adminImportManifestTemplate}\n`, 'utf8');
  }
};

const parseManifestCsv = (csv: string) => {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return new Map<string, Record<string, string>>();
  const headers = rows[0].map((item) => item.trim());
  const byFilename = new Map<string, Record<string, string>>();
  for (const values of rows.slice(1)) {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const filename = String(record.filename ?? '').trim();
    if (filename) byFilename.set(filename, record);
  }
  return byFilename;
};

const readAdminImportManifests = async () => {
  const manifests = new Map<string, Record<string, string>>();
  const stack = [ADMIN_IMPORT_ROOT];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.name.toLowerCase() === 'manifest.csv') {
        const relativeDir = path.relative(ADMIN_IMPORT_ROOT, current);
        const parsed = parseManifestCsv(await readFile(absolutePath, 'utf8'));
        for (const [filename, record] of parsed.entries()) {
          manifests.set(path.join(relativeDir, filename), record);
          manifests.set(filename, record);
        }
      }
    }
  }
  return manifests;
};

const scanAdminImportAudioFiles = async () => {
  await ensureAdminImportFolders();
  const manifests = await readAdminImportManifests();
  const files: Array<{ absolutePath: string; relativePath: string; sizeBytes: number; ext: string }> = [];
  const stack = [ADMIN_IMPORT_ROOT];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedAudioUploadExtensions.has(ext)) continue;
      const relativePath = path.relative(ADMIN_IMPORT_ROOT, absolutePath);
      const info = await stat(absolutePath);
      files.push({ absolutePath, relativePath, sizeBytes: info.size, ext });
    }
  }
  const inspected = [];
  const hashes: string[] = [];
  for (const file of files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    const sha256 = await hashFileSha256(file.absolutePath);
    hashes.push(sha256);
    const inspection = await inspectUploadedAudio(file.absolutePath);
    const manifest = manifests.get(file.relativePath) ?? manifests.get(path.basename(file.relativePath)) ?? {};
    const suggestion = inferUploadMetadata(file.relativePath, contentTypeForAudioExt(file.ext), inspection.tags, sha256, inspection.durationSeconds, inspection.sampleRate);
    suggestion.name = manifest.title || manifest.name || suggestion.name;
    suggestion.sourcePlatform = manifest.source_platform || manifest.sourcePlatform || suggestion.sourcePlatform;
    suggestion.sourceUrl = manifest.source_url || manifest.sourceUrl || suggestion.sourceUrl;
    suggestion.sourceCreator = manifest.creator || manifest.source_creator || manifest.sourceCreator || suggestion.sourceCreator;
    suggestion.licenseName = manifest.license_name || manifest.licenseName || suggestion.licenseName;
    suggestion.licenseUrl = manifest.license_url || manifest.licenseUrl || suggestion.licenseUrl;
    suggestion.commercialUseAllowed = String(manifest.commercial_use_allowed || manifest.commercialUseAllowed || '').toLowerCase() === 'true';
    suggestion.derivativeUseAllowed = String(manifest.derivative_use_allowed || manifest.derivativeUseAllowed || '').toLowerCase() === 'true';
    if (manifest.notes) suggestion.description = `${suggestion.description} 备注：${manifest.notes}`;
    inspected.push({ ...file, sha256, suggestion });
  }
  const existing = hashes.length > 0
    ? await query<any>('select id, file_sha256 from audio_stems where file_sha256 = any($1)', [hashes])
    : { rows: [] };
  const existingByHash = new Map(existing.rows.map((row: any) => [row.file_sha256, row.id]));
  return inspected.map((file) => ({
    relativePath: file.relativePath,
    sizeBytes: file.sizeBytes,
    existingStemId: existingByHash.get(file.sha256) ?? null,
    status: existingByHash.has(file.sha256) ? 'duplicate' : 'ready',
    suggestion: file.suggestion,
  }));
};

const summarizeAdminImportShelves = (files: Array<{ relativePath: string; status: string }>) => adminImportFolderPlan.map((folder) => {
  const prefix = `${folder}/`;
  const shelfFiles = files.filter((file) => file.relativePath.startsWith(prefix));
  return {
    folder,
    total: shelfFiles.length,
    ready: shelfFiles.filter((file) => file.status === 'ready').length,
    duplicate: shelfFiles.filter((file) => file.status === 'duplicate').length,
  };
});

const inferUploadMetadata = (filename: string, contentType: string, tags: Record<string, string>, sha256: string, durationSeconds: number | null, sampleRate: number | null) => {
  const normalized = `${filename} ${Object.values(tags).join(' ')}`.toLowerCase();
  const explicitlyNoVoice = hasAnyKeyword(normalized, ['no_voice', 'no voice', 'voice-free', 'voice free', '无人声', '无人']);
  let category: 'Nature' | 'Music' | 'Noise' | 'Voice' | 'Accent' = 'Nature';
  if (explicitlyNoVoice && hasAnyKeyword(normalized, ['asmr', 'brushing', 'tapping', 'paper', 'fabric', 'brush', 'tap', '敲击', '刷', '纸', '布'])) category = 'Accent';
  else if (!explicitlyNoVoice && hasAnyKeyword(normalized, ['voice', 'vocal', 'speech', 'narration', 'tts', 'spoken', '人声', '朗读', '旁白'])) category = 'Voice';
  else if (hasAnyKeyword(normalized, ['music', 'guitar', 'piano', 'pad', 'drone', 'ambient', 'meditation', 'tone', 'melody', 'song', '音乐', '钢琴', '吉他'])) category = 'Music';
  else if (hasAnyKeyword(normalized, ['noise', 'white', 'pink', 'brown', 'fan', 'hum', 'static', '噪音', '白噪', '粉噪', '棕噪', '风扇'])) category = 'Noise';
  else if (hasAnyKeyword(normalized, ['bell', 'chime', 'bowl', 'gong', 'accent', 'hit', 'transition', '铃', '钟', '钵', '点缀'])) category = 'Accent';

  const tagSet = new Set<string>();
  const addTags = (items: string[]) => items.forEach((item) => tagSet.add(item));
  if (category === 'Nature') addTags(['自然声']);
  if (category === 'Music') addTags(['音乐']);
  if (category === 'Noise') addTags(['噪音']);
  if (category === 'Voice') addTags(['人声', '待独立 QA']);
  if (category === 'Accent') addTags(['点缀']);
  if (hasAnyKeyword(normalized, ['asmr'])) addTags(['ASMR', '细节声']);
  if (hasAnyKeyword(normalized, ['tapping', 'tap', '敲击'])) addTags(['轻敲']);
  if (hasAnyKeyword(normalized, ['brushing', 'brush', '刷'])) addTags(['刷拂']);
  if (hasAnyKeyword(normalized, ['paper', '纸'])) addTags(['纸张']);
  if (hasAnyKeyword(normalized, ['fabric', 'cloth', '布'])) addTags(['布料']);
  if (hasAnyKeyword(normalized, ['rain', 'shower', 'storm', '雨'])) addTags(['雨声', '睡眠', '稳定']);
  if (hasAnyKeyword(normalized, ['ocean', 'sea', 'wave', 'surf', '海', '浪'])) addTags(['海浪', '水声', '放松']);
  if (hasAnyKeyword(normalized, ['river', 'stream', 'creek', 'brook', 'water', '溪', '河', '水'])) addTags(['水声', '流动', '夜醒回睡']);
  if (hasAnyKeyword(normalized, ['forest', 'woods', 'tree', '森林'])) addTags(['森林', '自然声']);
  if (hasAnyKeyword(normalized, ['bird', 'birds', '鸟'])) addTags(['鸟声', '清晨']);
  if (hasAnyKeyword(normalized, ['cricket', 'insect', '虫', '蟋蟀'])) addTags(['虫鸣', '夜晚']);
  if (hasAnyKeyword(normalized, ['wind', 'breeze', '风'])) addTags(['风声', '柔和']);
  if (hasAnyKeyword(normalized, ['fire', 'fireplace', 'campfire', '火'])) addTags(['火焰', '温暖']);
  if (hasAnyKeyword(normalized, ['sleep', 'bedtime', 'night', '睡眠', '夜'])) addTags(['睡眠']);
  if (hasAnyKeyword(normalized, ['calm', 'relax', 'relaxing', 'soothing', '放松'])) addTags(['放松']);
  if (hasAnyKeyword(normalized, ['focus', 'work', 'study', '专注', '工作'])) addTags(['专注']);

  const title = tags.title?.trim() || titleCaseAssetName(filename);
  const durationText = durationSeconds ? `${Math.round(durationSeconds)} 秒` : '未知时长';
  const sampleRateText = sampleRate ? `${sampleRate} Hz` : '未知采样率';
  const sourcePlatform = hasAnyKeyword(normalized, ['mixkit']) ? 'Mixkit'
    : hasAnyKeyword(normalized, ['pixabay']) ? 'Pixabay'
      : hasAnyKeyword(normalized, ['freesound']) ? 'Freesound'
        : hasAnyKeyword(normalized, ['fma', 'free music archive']) ? 'Free Music Archive'
          : '后台上传';
  const licenseName = tags.license || tags.copyright || (hasAnyKeyword(normalized, ['cc0']) ? '推测 CC0，需人工复核' : '待确认授权');
  return {
    name: title,
    category,
    tags: Array.from(tagSet).slice(0, 12).join(', '),
    description: `${category === 'Music' ? '音乐素材' : category === 'Noise' ? '噪音素材' : category === 'Voice' ? '人声候选素材' : category === 'Accent' ? '点缀素材' : '自然环境声素材'}。自动识别自文件「${filename}」，${durationText}，${sampleRateText}，hash ${sha256.slice(0, 12)}。上传后仍需授权、机器 QA 和人工听感 QA。`,
    defaultVolume: category === 'Music' ? 48 : category === 'Accent' ? 35 : category === 'Voice' ? 45 : 60,
    sourcePlatform,
    sourceCreator: tags.artist || tags.album_artist || tags.composer || '',
    sourceUrl: '',
    licenseName,
    licenseUrl: '',
    commercialUseAllowed: false,
    derivativeUseAllowed: false,
    attributionRequired: true,
    rawRedistributionAllowed: false,
    fileSha256: sha256,
    durationSeconds,
    sampleRate,
    contentType,
    warnings: [
      '自动识别只用于预填表单，不代表授权已经通过。',
      ...(category === 'Voice' ? ['当前 Voice-free Beta 下，人声素材不能进入公开发布池。'] : []),
    ],
  };
};

const collectRawRequestBody = (req: express.Request, maxBytes = 100 * 1024 * 1024) => new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > maxBytes) {
      reject(Object.assign(new Error('Uploaded audio is too large. Keep files under 100 MB.'), { statusCode: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const parseMultipartUpload = (contentType: string, body: Buffer) => {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw Object.assign(new Error('Missing multipart boundary.'), { statusCode: 400 });
  const delimiter = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: { fieldName: string; filename: string; contentType: string; data: Buffer } | null = null;
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf(delimiter, cursor);
    if (start < 0) break;
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next < 0) break;
    cursor = next;
    let part = body.subarray(start + delimiter.length, next);
    if (part.subarray(0, 2).toString() === '--') break;
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.subarray(-2).toString() === '\r\n') part = part.subarray(0, -2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd < 0) continue;
    const headers = part.subarray(0, headerEnd).toString('utf8');
    const data = part.subarray(headerEnd + 4);
    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] ?? '';
    const name = disposition.match(/name="([^"]+)"/i)?.[1] ?? '';
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1] ?? '';
    const partContentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? 'application/octet-stream';
    if (!name) continue;
    if (filename) {
      file = { fieldName: name, filename, contentType: partContentType, data };
    } else {
      fields[name] = data.toString('utf8').trim();
    }
  }
  return { fields, file };
};

const mapMix = (row: any) => ({
  id: row.id,
  creatorId: row.creator_id,
  title: row.title,
  description: row.description,
  coverImageUrl: row.cover_image_url,
  status: row.status,
  recipeData: upgradeRecipeToV2(row.recipe_data, row.id),
  renderStatus: row.render_status,
  renderedAudioUrl: row.rendered_audio_url,
  renderedAt: row.rendered_at,
  renderError: row.render_error,
  publishedVersionId: row.published_version_id ?? null,
  playsCount: row.plays_count,
  likesCount: row.likes_count,
  shareClicks: row.share_clicks,
  completion50Count: row.completion_50_count,
  completion90Count: row.completion_90_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapShareLink = (row: any) => ({
  id: row.id,
  slug: row.slug,
  mixId: row.mix_id,
  recipeVersionId: row.recipe_version_id,
  creatorId: row.creator_id,
  intent: row.intent,
  visibility: row.visibility,
  title: row.title_snapshot,
  description: row.description_snapshot,
  coverImageUrl: row.cover_snapshot,
  creatorName: row.creator_name_snapshot,
  soundElements: row.sound_elements ?? [],
  recipientLabel: row.recipient_label,
  recipientClaimed: Boolean(row.recipient_user_id),
  personalMessage: row.personal_message,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  createdAt: row.created_at,
});

const mixToTracks = (mix: any, stems: any[]) => planRecipeRenderTracks(mix.recipeData).map((track: any, index: number) => {
  const stem = stems.find((item) => item.id === track.stemId);
  return {
    id: index + 1,
    stemId: track.stemId,
    name: stem?.name ?? 'Unknown Stem',
    url: stem?.audioUrl ?? '/audio/rain.wav',
    volume: track.volume,
    sourceGainDb: track.sourceGainDb,
    fade: track.fade,
    loop: track.loop,
    isMuted: track.isMuted,
    startTime: track.startTime,
    duration: track.duration,
    sourceDuration: 600,
    trimStart: track.trimStart,
    trimEnd: track.trimEnd,
    tags: stem?.tags ?? [],
    role: track.role,
    eventId: track.eventId,
    phaseIds: track.phaseIds,
    playbackRate: track.playbackRate,
    musicKitId: track.musicKitId,
    musicKitVersion: track.musicKitVersion,
    musicPart: track.musicPart,
    volumeAutomation: track.volumeAutomation,
    duckingRules: mix.recipeData.ducking ?? [],
  };
});

const getAllStems = async () => {
  const result = await query<any>(
    `select * from audio_stems
     where qa_status = 'approved'
       and commercial_use_allowed = true
       and derivative_use_allowed = true
     order by is_premium asc, name asc`,
  );
  const databaseStems = result.rows.map(mapStem);
  const databaseIds = new Set(databaseStems.map((stem: any) => stem.id));
  const internalBaselineStems = getInternalBaselineStems().filter((stem) => !databaseIds.has(stem.id));
  const knownIds = new Set([...databaseIds, ...internalBaselineStems.map((stem) => stem.id)]);
  const atomicFoundationStems = getAtomicFoundationStems().filter((stem) => !knownIds.has(stem.id));
  const knownWithAtomicIds = new Set([...knownIds, ...atomicFoundationStems.map((stem) => stem.id)]);
  const foundationalEligibilityStems = getFoundationalEligibilityStems().filter((stem) => !knownWithAtomicIds.has(stem.id));
  return [...databaseStems, ...internalBaselineStems, ...atomicFoundationStems, ...foundationalEligibilityStems];
};

const getApprovedEnvironmentStemIds = async () => {
  const approved = await getAllStems();
  const approvedIds = new Set(approved.map((stem: any) => stem.id));
  const candidateByKey = {
    rain: ['stem_mixkit_rain_2394', 'stem_mixkit_2474'],
    ocean: ['stem_mixkit_ocean_1195'],
    forest: ['stem_commons_pine_forest_wind', 'stem_mixkit_1213', 'stem_mixkit_forest_1210'],
    water: ['stem_mixkit_3126'],
    waterfall: ['stem_mixkit_waterfall_2517'],
    fire: [],
    pond: ['stem_mixkit_pond_1783'],
    wind: ['stem_commons_pine_forest_wind', 'stem_mixkit_2658'],
  } as const;
  return Object.fromEntries(
    Object.entries(candidateByKey).flatMap(([key, ids]) => {
      const stemId = ids.find((id) => approvedIds.has(id));
      return stemId ? [[key, stemId]] : [];
    }),
  );
};

const getAllUsers = async () => {
  const result = await query<any>('select * from users order by username asc');
  return result.rows.map(mapUser);
};

const getMixById = async (id: string) => {
  const result = await query<any>('select * from mixes where id = $1', [id]);
  return result.rows[0] ? mapMix(result.rows[0]) : null;
};

const hasAudibleRecipeContent = (recipeData: any) =>
  planRecipeRenderTracks(upgradeRecipeToV2(recipeData, 'release-audibility-check')).length > 0;

const freezeRecipeVersion = async (mixId: string, recipeData: any) => {
  if (!hasAudibleRecipeContent(recipeData)) {
    throw new Error('A released soundscape must contain at least one audible track.');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select id from mixes where id = $1 for update', [mixId]);
    const versionResult = await client.query<{ next_version: number }>(
      `select coalesce(max(version_number), 0) + 1 as next_version
       from mix_recipe_versions where mix_id = $1`,
      [mixId],
    );
    const versionNumber = Number(versionResult.rows[0]?.next_version ?? 1);
    const versionId = uid('recipev');
    const frozenRecipe = {
      ...upgradeRecipeToV2(recipeData, `${mixId}|${versionNumber}`),
      versionId,
      versionState: 'frozen',
      versionNumber,
      frozenAt: new Date().toISOString(),
    };
    await client.query(
      `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data)
       values ($1, $2, $3, $4::jsonb)`,
      [versionId, mixId, versionNumber, JSON.stringify(frozenRecipe)],
    );
    await client.query(
      `update mixes set published_version_id = $2, recipe_data = $3::jsonb, updated_at = now()
       where id = $1`,
      [mixId, versionId, JSON.stringify(frozenRecipe)],
    );
    await client.query('commit');
    return frozenRecipe;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

const getPublishedRecipe = async (mix: any) => {
  if (!mix.publishedVersionId) return mix.recipeData;
  const result = await query<any>(
    `select recipe_data from mix_recipe_versions where id = $1 and mix_id = $2`,
    [mix.publishedVersionId, mix.id],
  );
  return result.rows[0]?.recipe_data ?? mix.recipeData;
};

const requireDownloadableMix = async (req: express.Request, res: express.Response) => {
  const mix = await getMixById(String(req.params.id));
  if (!mix) {
    res.status(404).json({ error: 'Mix not found' });
    return null;
  }
  if (mix.status !== 'published') {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return null;
    if (mix.creatorId !== user.id) {
      res.status(403).json({ error: 'You can only download your own private mixes.' });
      return null;
    }
  }
  return mix;
};

const safeDownloadBaseName = (mix: any) =>
  mix.title.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || mix.id;

const getWorkAttributionSidecar = async (mix: any) => {
  const recipe = await getPublishedRecipe(mix);
  const plannedTracks = planRecipeRenderTracks(recipe);
  const stemIds = Array.from(new Set<string>(plannedTracks.map((track: any) => String(track.stemId))));
  const stems = await getStemRowsByIds(stemIds);
  return buildWorkAttributionSidecar({
    mixId: mix.id,
    title: mix.title,
    recipeVersionId: mix.publishedVersionId,
    recipe,
    stems,
  });
};

const getStemRowsByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)];
  const result = await query<any>('select * from audio_stems where id = any($1)', [uniqueIds]);
  const databaseStems = result.rows.map(mapStem);
  const databaseIds = new Set(databaseStems.map((stem: any) => stem.id));
  const internalBaselineStems = getInternalBaselineStems()
    .filter((stem) => uniqueIds.includes(stem.id) && !databaseIds.has(stem.id));
  const knownIds = new Set([...databaseIds, ...internalBaselineStems.map((stem) => stem.id)]);
  const atomicFoundationStems = getAtomicFoundationStems()
    .filter((stem) => uniqueIds.includes(stem.id) && !knownIds.has(stem.id));
  const knownWithAtomicIds = new Set([...knownIds, ...atomicFoundationStems.map((stem) => stem.id)]);
  const foundationalEligibilityStems = getFoundationalEligibilityStems()
    .filter((stem) => uniqueIds.includes(stem.id) && !knownWithAtomicIds.has(stem.id));
  return [...databaseStems, ...internalBaselineStems, ...atomicFoundationStems, ...foundationalEligibilityStems];
};

const getStemsForMixTracks = async (mix: any) => {
  const ids = Array.from(new Set<string>((mix.recipeData.tracks ?? []).map((track: any) => String(track.stemId))));
  return getStemRowsByIds(ids);
};

const getApprovedAlternativeStems = async (blockedStem: any, excludedStemIds: string[], limit = 3) => {
  const result = await query<any>(
    `select * from audio_stems
     where qa_status = 'approved'
       and commercial_use_allowed = true
       and derivative_use_allowed = true
       and category = $1
       and id <> all($2)
     order by is_premium asc, default_volume desc, name asc
     limit $3`,
    [blockedStem.category, excludedStemIds, limit],
  );
  return result.rows.map(mapStem);
};

const getExportCheck = async (mix: any) => {
  const audibleTracks = mix.recipeData.tracks.filter((track: any) => !track.isMuted && Number(track.volume ?? 0) > 0);
  const stemIds = Array.from(new Set<string>(audibleTracks.map((track: any) => String(track.stemId))));
  const stems = await getStemRowsByIds(stemIds);
  const stemById = new Map(stems.map((stem: any) => [stem.id, stem]));
  const usedStemIds = Array.from(new Set<string>(mix.recipeData.tracks.map((track: any) => String(track.stemId))));
  const blockedStems = (await Promise.all(audibleTracks
    .map((track: any) => {
      const stem = stemById.get(track.stemId);
      const voiceBlockedByRelease = !productCapabilities.guidedVoice && (track.role === 'voice' || stem?.category === 'Voice');
      if (!voiceBlockedByRelease && stem && stem.qaStatus === 'approved' && stem.commercialUseAllowed && stem.derivativeUseAllowed) return null;
      const reasons = [];
      if (voiceBlockedByRelease) reasons.push('voice_disabled_in_beta');
      if (!stem) reasons.push('missing_asset');
      if (stem && stem.qaStatus !== 'approved') reasons.push(`qa_${stem.qaStatus}`);
      if (stem && !stem.commercialUseAllowed) reasons.push('commercial_use_not_allowed');
      if (stem && !stem.derivativeUseAllowed) reasons.push('derivative_use_not_allowed');
      return {
        stemId: String(track.stemId),
        name: stem?.name ?? 'Unknown Stem',
        category: stem?.category ?? 'Unknown',
        qaStatus: stem?.qaStatus ?? 'missing',
        commercialUseAllowed: Boolean(stem?.commercialUseAllowed),
        derivativeUseAllowed: Boolean(stem?.derivativeUseAllowed),
        reasons,
      };
    })
    .filter(Boolean)
    .map(async (blockedStem: any) => ({
      ...blockedStem,
      alternatives: await getApprovedAlternativeStems(blockedStem, usedStemIds, 3),
    }))));

  return {
    exportReady: audibleTracks.length > 0 && blockedStems.length === 0,
    audibleTrackCount: audibleTracks.length,
    blockedStems,
  };
};

const findApprovedAlternativeStem = async (blockedStem: any, excludedStemIds: string[]) => {
  const alternatives = await getApprovedAlternativeStems(blockedStem, excludedStemIds, 1);
  return alternatives[0] ?? null;
};

const getRecipeStemIds = (recipe: CatalogRecipe) => Array.from(new Set(recipe.tracks.map((track) => track.stemId)));

const assertRecipeIsExportEligible = async (recipe: CatalogRecipe) => {
  const stems = await getStemRowsByIds(getRecipeStemIds(recipe));
  const approvedStemIds = new Set(
    stems
      .filter((stem: any) => stem.qaStatus === 'approved' && stem.commercialUseAllowed && stem.derivativeUseAllowed)
      .map((stem: any) => stem.id),
  );
  const missing = recipe.tracks.filter((track) => !approvedStemIds.has(track.stemId));
  if (missing.length > 0) {
    throw new Error(`Catalog recipe contains stems that are not approved for export: ${missing.map((track) => track.stemId).join(', ')}`);
  }
  return stems;
};

const scaleRecipeDuration = (recipe: CatalogRecipe, durationSeconds: number) => {
  const scale = durationSeconds / recipe.durationSeconds;
  return recipe.tracks.map((track) => ({
    stemId: track.stemId,
    role: track.role,
    volume: track.volume,
    isMuted: track.isMuted,
    startTime: Math.round(track.startTime * scale),
    duration: Math.max(1, Math.round(track.duration * scale)),
    trimStart: track.trimStart,
    trimEnd: track.trimEnd,
    musicKitId: track.musicKitId,
    musicKitVersion: track.musicKitVersion,
    musicPart: track.musicPart,
    sourceGainDb: track.sourceGainDb,
    volumeAutomation: track.volumeAutomation?.map((point) => ({
      atSeconds: Math.round(point.atSeconds * scale),
      volume: point.volume,
    })),
  }));
};

const selectDefaultScene = (goal: ProductGoal, prompt: string): ProductScene => {
  const lower = prompt.toLowerCase();
  if (goal === 'sleep') return /(wake|woke|return|back to sleep|夜醒|半夜|回睡|重新入睡)/.test(lower) ? 'return_to_sleep' : 'bedtime';
  if (goal === 'calm') return /(breath|breathe|box breathing|呼吸|正念)/.test(lower) ? 'breathing' : 'emotional_settling';
  return 'deep_focus';
};

const exclusionAliases: Record<string, string[]> = {
  water: ['water', 'river', 'stream', 'waterfall', 'ocean', 'sea', 'wave', 'rain'],
  river: ['river', 'stream', 'water'],
  stream: ['stream', 'river', 'water'],
  waterfall: ['waterfall', 'water'],
  rain: ['rain', 'water'],
  ocean: ['ocean', 'sea', 'wave', 'water'],
  wind: ['wind', 'breeze'],
  birds: ['bird', 'birds', 'birdsong'],
  voice: ['voice', 'vocal', 'speech', 'spoken', 'narration', 'guide', 'guided'],
  music: ['music', 'melody', 'instrument', 'piano', 'guitar', 'rhodes', 'pad', 'drone'],
};

const assertRecipeMatchesIntent = async (recipe: CatalogRecipe, audioIntent: Pick<ReturnType<typeof parseAudioIntentV2>, 'goal' | 'scene' | 'contentMode' | 'excludedSounds' | 'environmentPreferences'>) => {
  if (recipe.goal !== audioIntent.goal || recipe.scene !== audioIntent.scene) {
    throw new Error(`Recipe contract mismatch: ${recipe.id} does not match ${audioIntent.goal}/${audioIntent.scene}.`);
  }
  const expectedMode = audioIntent.contentMode === 'guided_meditation' ? 'sound_journey' : audioIntent.contentMode;
  if (recipe.contentMode !== expectedMode) {
    throw new Error(`Recipe contract mismatch: ${recipe.id} is ${recipe.contentMode}, expected ${expectedMode}.`);
  }
  const recipeText = `${recipe.id} ${recipe.name} ${recipe.moodTags.join(' ')}`.toLowerCase();
  const matchesRecipeTerm = (term: string) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(recipeText);
  };
  const stemRows = await getStemRowsByIds(recipe.tracks.map((track) => track.stemId));
  const stemText = stemRows
    .map((stem: any) => `${stem.id} ${stem.name} ${stem.description ?? ''} ${(stem.tags ?? []).join(' ')} ${stem.audioUrl ?? ''}`)
    .join(' ')
    .toLowerCase();
  const matchesAny = (text: string, aliases: string[]) => aliases.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|["\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
  });
  for (const sound of audioIntent.excludedSounds) {
    if (sound === 'voice' || sound === 'music') continue;
    const aliases = exclusionAliases[sound] ?? [sound];
    if (matchesAny(recipeText, aliases) || matchesAny(stemText, aliases)) {
      throw new Error(`Recipe contract mismatch: ${recipe.id} contains excluded ${sound}.`);
    }
  }
  if (audioIntent.excludedSounds.includes('music') && recipe.tracks.some((track) => track.role === 'music' && track.volume > 0)) {
    throw new Error(`Recipe contract mismatch: ${recipe.id} contains excluded music.`);
  }
  const preferenceAliases: Record<string, string[]> = {
    rain: ['rain'], ocean: ['ocean', 'sea'], forest: ['forest'], fire: ['fire'],
    train: ['train', 'carriage'], indoor: ['office', 'fan', 'room'], water: ['water', 'river', 'stream'],
  };
  const matchesAlias = matchesRecipeTerm;
  if (audioIntent.environmentPreferences.length > 0) {
    const preferenceMatched = audioIntent.environmentPreferences.some((preference) =>
      preference === 'music'
        ? recipe.tracks.some((track) => track.role === 'music' && track.volume > 0)
        : (preferenceAliases[preference] ?? [preference]).some(matchesAlias));
    if (!preferenceMatched) throw new Error(`Recipe contract mismatch: ${recipe.id} ignores explicit environment preferences.`);
  }
};

const shouldKeepParsedMusicExclusion = (prompt: string) => {
  const lower = prompt.toLowerCase();
  const hardNoMusic = /(?:no|without|exclude|remove|不要|不想要|没有|去掉|不能有|不能包含|不能出现)[^,.，。]{0,20}(?:music|音乐|轻音乐)/i.test(lower)
    || /(?:music|音乐|轻音乐)[^,.，。]{0,10}(?:不要|去掉|不能有|不能包含|不能出现)/i.test(lower);
  const melodyOnlyExclusion = /(?:no|without|exclude|remove|不要|不想要|没有|去掉|不能有|不能包含|不能出现)[^,.，。]{0,20}(?:melody|旋律)/i.test(lower)
    || /(?:melody|旋律)[^,.，。]{0,10}(?:不要|去掉|不能有|不能包含|不能出现)/i.test(lower);
  const asksForInstrumentalHint = /piano|guitar|rhodes|instrumental|钢琴|吉他|电钢琴|乐器感|音乐感|轻音乐感/i.test(lower);
  if (melodyOnlyExclusion && !hardNoMusic) return false;
  return hardNoMusic || !asksForInstrumentalHint;
};

const reconcileFoundationalExcludedSounds = (prompt: string, excludedSounds: string[]) => {
  if (shouldKeepParsedMusicExclusion(prompt)) return excludedSounds;
  return excludedSounds.filter((sound) => sound !== 'music');
};

const explicitlyRequestsMusicKit = (prompt: string, audioIntent: Pick<PlannedAudioIntent, 'excludedSounds'>) => {
  const lower = prompt.toLowerCase();
  const hardNoMusic = /(?:no|without|exclude|remove|不要|不想要|没有|去掉|不能有|不能包含|不能出现)[^,.，。]{0,24}(?:music|song|track|piano|guitar|rhodes|instrumental|音乐|曲子|轻音乐|钢琴|吉他|电钢琴|乐器)/i.test(lower)
    || /(?:music|song|track|piano|guitar|rhodes|instrumental|音乐|曲子|轻音乐|钢琴|吉他|电钢琴|乐器)[^,.，。]{0,12}(?:不要|去掉|不能有|不能包含|不能出现)/i.test(lower);
  if (hardNoMusic || audioIntent.excludedSounds.includes('music')) return false;
  return /(?:^|[^a-z0-9])(?:music|song|track|instrumental|piano|guitar|rhodes|electric piano|ambient music|lo-?fi)(?:$|[^a-z0-9])|音乐|曲子|轻音乐|纯音乐|器乐|钢琴|吉他|电钢琴/i.test(lower);
};

const createDraftFromCatalogRecipe = async (input: {
  userId: string;
  recipe: CatalogRecipe;
  durationSeconds: number;
  prompt: string;
  guidedVoice: boolean;
  languagePreference: LanguagePreference;
  resolvedLanguage: ResolvedLanguage;
  soundProfile: {
    likedSounds: string[];
    excludedSounds: string[];
    defaultGoal: ProductGoal;
    defaultDurationSeconds: number;
  };
  audioIntent: PlannedAudioIntent;
  generationDecision?: GenerationDecision;
}) => {
  const stems = await assertRecipeIsExportEligible(input.recipe);
  const durationSeconds = Math.max(300, Math.min(7200, Math.round(input.durationSeconds)));
  const scaledTracks = scaleRecipeDuration(input.recipe, durationSeconds).map((track) => {
    const role = String(track.role);
    const intensity = role === 'environment' || role === 'accent'
      ? input.audioIntent.intensity.environment
      : role === 'music'
        ? input.audioIntent.intensity.music
        : role === 'voice'
          ? input.audioIntent.intensity.voice
          : 50;
    // Focus should feel steady and unobtrusive by default; loud foreground
    // music defeats the user's request for sustained attention.
    const focusComfortScale = input.audioIntent.goal === 'focus' ? 0.68 : 1;
    const intensityScale = (intensity / 50) * focusComfortScale;
    return {
      ...track,
      sourceGainDb: track.sourceGainDb ?? 0,
      volume: Math.max(0, Math.min(100, Math.round(track.volume * intensityScale))),
      volumeAutomation: track.volumeAutomation?.map((point) => ({
        ...point,
        volume: Math.max(0, Math.min(100, Math.round(point.volume * intensityScale))),
      })),
    };
  });
  const supply = input.generationDecision ? {
    kind: input.generationDecision.kind,
    missing: input.generationDecision.missing,
    fullTrackProviderAllowed: input.generationDecision.fullTrackProviderAllowed,
    reason: input.generationDecision.reason,
    generationSpec: input.generationDecision.generationSpec ? {
      role: input.generationDecision.generationSpec.role,
      targetConceptIds: input.generationDecision.generationSpec.targetConceptIds,
      providerPolicy: input.generationDecision.generationSpec.providerPolicy,
      candidateCount: input.generationDecision.generationSpec.candidateCount,
      loopRequired: input.generationDecision.generationSpec.loopRequired,
    } : null,
  } : undefined;
  const recipeData = createCatalogRecipeV2({
    recipe: input.recipe,
    tracks: scaledTracks,
    durationSeconds,
    prompt: input.prompt,
    guidedVoice: input.guidedVoice,
    languagePreference: input.languagePreference,
    resolvedLanguage: input.resolvedLanguage,
    soundProfile: input.soundProfile,
    audioIntent: input.audioIntent,
    supply,
  });
  const titleSuffix = input.guidedVoice ? ' with Guide Draft' : '';
  const mixResult = await query<any>(
    `insert into mixes (id, creator_id, title, description, cover_image_url, status, recipe_data)
     values ($1, $2, $3, $4, $5, 'draft', $6::jsonb)
     returning *`,
    [
      uid('mix'),
      input.userId,
      `${input.recipe.name}${titleSuffix}`,
      `A ${Math.round(durationSeconds / 60)} minute ${input.audioIntent.goal} soundscape arranged from approved audio layers.`,
      coverForIntent(input.audioIntent.goal, input.audioIntent.scene),
      JSON.stringify(recipeData),
    ],
  );
  const mix = mapMix(mixResult.rows[0]);
  return {
    mix,
    stems,
    tracks: mixToTracks(mix, stems),
    recipe: input.recipe,
  };
};

const createDraftFromComposerResultRenderPilot = async (input: Parameters<typeof createDraftFromCatalogRecipe>[0] & {
  proofAudioUrl: string;
  proofId: string;
  composerMode: 'music_supported' | 'support_only';
}) => {
  const created = await createDraftFromCatalogRecipe(input);
  const recipeData = {
    ...created.mix.recipeData,
    quickCreate: {
      ...objectRecord(created.mix.recipeData.quickCreate),
      composerRenderPilot: {
        source: 'composer_result_render_proof_v1',
        proofId: input.proofId,
        composerMode: input.composerMode,
        renderedAudioUrl: input.proofAudioUrl,
        productionAllowed: false,
        publicReleaseAllowed: false,
      },
    },
    audit: {
      ...(created.mix.recipeData.audit ?? {}),
      renders: [
        ...((created.mix.recipeData.audit?.renders ?? []) as any[]),
        {
          status: 'ready',
          renderedAudioUrl: input.proofAudioUrl,
          createdAt: new Date().toISOString(),
          source: 'composer_result_render_proof_v1',
          proofId: input.proofId,
        },
      ],
    },
  };
  const result = await query<any>(
    `update mixes
       set recipe_data = $2::jsonb,
           render_status = 'ready',
           rendered_audio_url = $3,
           rendered_at = now(),
           render_error = '',
           updated_at = now()
     where id = $1
     returning *`,
    [created.mix.id, JSON.stringify(recipeData), input.proofAudioUrl],
  );
  const mix = mapMix(result.rows[0]);
  return {
    ...created,
    mix,
    tracks: mixToTracks(mix, created.stems),
  };
};

const resolvePublicFilePath = (publicUrl: string) => {
  if (!publicUrl.startsWith('/')) throw new Error(`Only local public URLs can be rendered: ${publicUrl}`);
  const resolved = path.resolve(PUBLIC_DIR, publicUrl.slice(1));
  if (!resolved.startsWith(PUBLIC_DIR)) throw new Error(`Unsafe asset path: ${publicUrl}`);
  if (!existsSync(resolved)) throw new Error(`Asset file does not exist: ${publicUrl}`);
  return resolved;
};

const runFfmpeg = (args: string[]) => new Promise<void>((resolve, reject) => {
  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });
  child.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      reject(new Error('ffmpeg is not installed. Install ffmpeg to enable MP3 export.'));
      return;
    }
    reject(error);
  });
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
  });
});

const probeAudioSource = (filePath: string) => new Promise<{ durationSeconds: number; sampleRate: number }>((resolve, reject) => {
  const child = spawn('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'format=duration:stream=sample_rate',
    '-of', 'json',
    filePath,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code !== 0) {
      reject(new Error(stderr.trim() || `ffprobe exited with code ${code}`));
      return;
    }
    try {
      const payload = JSON.parse(stdout);
      const durationSeconds = Number(payload.format?.duration);
      const sampleRate = Number(payload.streams?.[0]?.sample_rate);
      if (!(durationSeconds > 0) || !(sampleRate > 0)) throw new Error('missing duration or sample rate');
      resolve({ durationSeconds, sampleRate });
    } catch (error) {
      reject(new Error(`Could not read audio metadata for ${filePath}: ${error instanceof Error ? error.message : error}`));
    }
  });
});

const inspectUploadedAudio = (filePath: string) => new Promise<{ durationSeconds: number | null; sampleRate: number | null; tags: Record<string, string> }>((resolve) => {
  const child = spawn('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'format=duration:format_tags=title,artist,album_artist,composer,genre,comment,copyright,license:stream=sample_rate',
    '-of', 'json',
    filePath,
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  let stdout = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.on('error', () => resolve({ durationSeconds: null, sampleRate: null, tags: {} }));
  child.on('close', (code) => {
    if (code !== 0) {
      resolve({ durationSeconds: null, sampleRate: null, tags: {} });
      return;
    }
    try {
      const payload = JSON.parse(stdout);
      const rawTags = payload.format?.tags && typeof payload.format.tags === 'object' ? payload.format.tags : {};
      const tags = Object.fromEntries(Object.entries(rawTags).map(([key, value]) => [key.toLowerCase(), String(value ?? '').trim()]).filter(([, value]) => value));
      const durationSeconds = Number(payload.format?.duration);
      const sampleRate = Number(payload.streams?.[0]?.sample_rate);
      resolve({
        durationSeconds: durationSeconds > 0 ? durationSeconds : null,
        sampleRate: sampleRate > 0 ? sampleRate : null,
        tags,
      });
    } catch {
      resolve({ durationSeconds: null, sampleRate: null, tags: {} });
    }
  });
});

const runProcessCapture = (command: string, args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(output.trim() || `${command} exited with code ${code}`)));
});

const lastNumber = (output: string, pattern: RegExp) => {
  const matches = Array.from(output.matchAll(pattern));
  return matches.length > 0 ? Number(matches[matches.length - 1][1]) : null;
};

const countInteriorSilences = (output: string, durationSeconds: number) => {
  const starts = Array.from(output.matchAll(/silence_start:\s*([\d.]+)/g)).map((match) => Number(match[1]));
  const ends = Array.from(output.matchAll(/silence_end:\s*([\d.]+)/g)).map((match) => Number(match[1]));
  return starts.filter((start, index) => {
    const end = ends[index] ?? durationSeconds;
    return start > 2 && end < durationSeconds - 2;
  }).length;
};

const analyzeRenderedAudio = async (filePath: string) => {
  const metadata = await probeAudioSource(filePath);
  const volumeOutput = await runProcessCapture('ffmpeg', ['-hide_banner', '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-']);
  const loudnessOutput = await runProcessCapture('ffmpeg', ['-hide_banner', '-i', filePath, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const silenceOutput = await runProcessCapture('ffmpeg', ['-hide_banner', '-i', filePath, '-af', 'silencedetect=noise=-50dB:d=1', '-f', 'null', '-']);
  const peakDb = lastNumber(volumeOutput, /max_volume:\s*(-?[\d.]+) dB/g);
  const meanDb = lastNumber(volumeOutput, /mean_volume:\s*(-?[\d.]+) dB/g);
  const integratedLufs = lastNumber(loudnessOutput, /I:\s*(-?[\d.]+) LUFS/g);
  const truePeakDb = lastNumber(loudnessOutput, /Peak:\s*(-?[\d.]+) dBFS/g);
  const abnormalSilenceCount = countInteriorSilences(silenceOutput, metadata.durationSeconds);
  return {
    durationSeconds: metadata.durationSeconds,
    peakDb,
    meanDb,
    integratedLufs,
    truePeakDb,
    abnormalSilenceCount,
    passed: abnormalSilenceCount === 0 && (peakDb === null || peakDb <= -1) && metadata.durationSeconds > 0,
  };
};

const renderMixToMp3 = async (mix: any, stems: any[]) => {
  const plannedTracks = planRecipeRenderTracks(mix.recipeData);
  const sourceInfoByPath = new Map<string, Promise<{ durationSeconds: number; sampleRate: number }>>();
  if (plannedTracks.length === 0) throw new Error('Mix has no audible tracks to render.');

  const stemById = new Map(stems.map((stem) => [stem.id, stem]));
  const blockedStems = plannedTracks
    .map((track: any) => stemById.get(track.stemId))
    .filter((stem: any) => !stem || stem.qaStatus !== 'approved' || !stem.commercialUseAllowed || !stem.derivativeUseAllowed);

  if (blockedStems.length > 0) {
    const names = blockedStems.map((stem: any) => stem?.name ?? 'Unknown Stem').join(', ');
    throw new Error(`Cannot render downloadable MP3 until these stems are approved for commercial derivative use: ${names}`);
  }

  const outputFileName = `${mix.id}-${Date.now()}.mp3`;
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'snooze-render-'));
  const outputPath = path.join(temporaryDirectory, outputFileName);
  const tracks = await Promise.all(plannedTracks.map(async (track: any) => {
    const stem = stemById.get(track.stemId);
    const filePath = resolvePublicFilePath(stem.audioUrl);
    let sourceInfo = sourceInfoByPath.get(filePath);
    if (!sourceInfo) {
      sourceInfo = probeAudioSource(filePath);
      sourceInfoByPath.set(filePath, sourceInfo);
    }
    const metadata = await sourceInfo;
    return {
      ...track,
      sourceDurationSeconds: resolveTrimmedSourceDuration(
        metadata.durationSeconds,
        track.trimStart,
        track.trimEnd,
      ),
      sourceSampleRate: metadata.sampleRate,
      sourceFilePath: filePath,
    };
  }));
  const inputArgs = tracks.flatMap((track: any) => {
    return [
      ...(track.loop?.enabled && !usesCrossfadeLoop(track) ? ['-stream_loop', '-1'] : []),
      '-ss', String(track.trimStart ?? 0), '-i', track.sourceFilePath,
    ];
  });
  const filterComplex = buildRecipeFilterComplex(tracks, mix.recipeData.durationSeconds, mix.recipeData.ducking ?? []);

  try {
    await runFfmpeg([
      '-y',
      ...inputArgs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[out]',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '2',
      outputPath,
    ]);
    const qaReport = await analyzeRenderedAudio(outputPath);
    const stored = await exportStorage.putFile(outputFileName, outputPath, 'audio/mpeg');
    return { renderedAudioUrl: stored.url, qaReport, bytes: stored.bytes };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
};

app.get('/api/health/live', (_req, res) => {
  res.json({ ok: true, service: 'snooze-api' });
});

app.get('/api/health/ready', async (_req, res) => {
  try {
    await query('select 1');
    setMetricGauge('snooze_database_ready', 1);
    res.json({ ok: true, database: 'ready' });
  } catch {
    setMetricGauge('snooze_database_ready', 0);
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.get('/internal/metrics', (req, res) => {
  const authorization = String(req.headers.authorization ?? '');
  if (runtimeConfig.production && authorization !== `Bearer ${runtimeConfig.metricsBearerToken}`) {
    res.status(401).json({ error: 'Metrics authentication required.' });
    return;
  }
  res.type('text/plain; version=0.0.4').send(renderMetrics());
});

app.get('/api/health', async (_req, res) => {
  try {
    await query('select 1');
    res.json({ ok: true, database: 'ready' });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const username = String(req.body.username ?? '').trim().slice(0, 60);
    const password = String(req.body.password ?? '');
    if (!isValidEmail(email) || !username || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Enter a valid email, a name, and a password of at least 8 characters.' });
      return;
    }
    const existing = await query<any>('select id from users where lower(email) = $1', [email]);
    if (existing.rows[0]) {
      res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
      return;
    }
    const currentUser = await getAuthenticatedUser(req);
    const isGuest = currentUser
      && !currentUser.password_hash
      && String(currentUser.email).endsWith('@snooze.invalid');
    const userResult = isGuest
      ? await query<any>(
        `update users set username = $2, email = $3, password_hash = $4, updated_at = now()
         where id = $1 returning *`,
        [currentUser.id, username, email, hashPassword(password)],
      )
      : await query<any>(
        `insert into users (id, username, email, avatar_url, role, subscription_tier, password_hash)
         values ($1, $2, $3, '', 'consumer', 'free', $4) returning *`,
        [uid('user'), username, email, hashPassword(password)],
      );
    const session = await createAuthSession(userResult.rows[0].id);
    res.status(201).json({ user: mapUser(userResult.rows[0]), ...session });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password ?? '');
    const result = await query<any>('select * from users where lower(email) = $1', [email]);
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash ?? '')) {
      res.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }
    const session = await createAuthSession(user.id);
    res.json({ user: mapUser(user), ...session });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/social', async (req, res, next) => {
  try {
    const provider = req.body.provider === 'apple' || req.body.provider === 'google'
      ? req.body.provider as 'apple' | 'google'
      : null;
    if (!provider) {
      res.status(400).json({ error: 'Choose Apple or Google to continue.' });
      return;
    }
    let identity: VerifiedSocialIdentity;
    try {
      identity = await verifySocialIdentity(provider, String(req.body.idToken ?? ''), String(req.body.name ?? ''));
    } catch (error) {
      if (typeof (error as { statusCode?: unknown })?.statusCode !== 'number') {
        throw Object.assign(new Error(`Could not verify the ${provider === 'apple' ? 'Apple' : 'Google'} sign-in token.`), {
          statusCode: 401,
          cause: error,
        });
      }
      throw error;
    }
    const user = await signInWithSocialIdentity(req, identity);
    const session = await createAuthSession(user.id);
    res.json({ user: mapUser(user), ...session });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/guest', async (_req, res, next) => {
  try {
    const userId = uid('user');
    const userResult = await query<any>(
      `insert into users (id, username, email, avatar_url, role, subscription_tier, password_hash)
       values ($1, 'Guest', $2, '', 'consumer', 'free', '') returning *`,
      [userId, `guest+${userId}@snooze.invalid`],
    );
    const session = await createAuthSession(userId);
    res.status(201).json({ user: mapUser(userResult.rows[0]), ...session });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not signed in.' });
      return;
    }
    res.json({ user: mapUser(user) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/me', async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (req.header('x-confirm-account-deletion') !== 'DELETE') {
      res.status(400).json({ error: 'Account deletion requires explicit confirmation.' });
      return;
    }
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sign in before deleting your account.' });
      return;
    }

    await client.query('begin');
    const mixes = await client.query<{ id: string; rendered_audio_url: string }>(
      'select id, rendered_audio_url from mixes where creator_id = $1',
      [user.id],
    );
    const mixIds = mixes.rows.map((row) => row.id);
    await client.query('delete from user_history where user_id = $1 or mix_id = any($2::text[])', [user.id, mixIds]);
    await client.query('delete from ai_sessions where user_id = $1 or generated_mix_id = any($2::text[])', [user.id, mixIds]);
    await client.query('delete from playback_events where user_id = $1', [user.id]);
    await client.query('delete from voice_qa_reviews where reviewer_id = $1', [user.id]);
    await client.query('update share_links set recipient_user_id = null where recipient_user_id = $1', [user.id]);
    await client.query('delete from share_links where creator_id = $1', [user.id]);
    await client.query('delete from mixes where creator_id = $1', [user.id]);
    await client.query('delete from users where id = $1', [user.id]);
    await client.query('commit');

    await Promise.all(mixes.rows.map((row) => exportStorage.deleteUrl(row.rendered_audio_url).catch(() => undefined)));
    res.json({ deleted: true });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    next(error);
  } finally {
    client.release();
  }
});

app.get('/api/me', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    res.json(mapUser(user));
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/billing', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    res.json(await getBillingEntitlement(user.id, user.subscription_tier));
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/sound-profile', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    res.json(await getSoundProfilePayload(user.id));
  } catch (error) {
    next(error);
  }
});

app.put('/api/me/sound-profile', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const current = await ensureSoundProfile(user.id);
    const likedSounds = req.body.likedSounds === undefined ? current.liked_sounds : normalizeSoundList(req.body.likedSounds);
    const excludedSounds = req.body.excludedSounds === undefined ? current.excluded_sounds : normalizeSoundList(req.body.excludedSounds);
    const defaultGoal = req.body.defaultGoal === undefined ? current.default_goal : normalizeDefaultGoal(req.body.defaultGoal);
    const defaultDurationSeconds = req.body.defaultDurationSeconds === undefined ? current.default_duration_seconds : normalizeDefaultDuration(req.body.defaultDurationSeconds);
    const sensitivity = req.body.sensitivity && typeof req.body.sensitivity === 'object' && !Array.isArray(req.body.sensitivity)
      ? req.body.sensitivity
      : current.sensitivity;

    await query(
      `update user_sound_profiles
       set liked_sounds = $2, excluded_sounds = $3, default_goal = $4,
         default_duration_seconds = $5, sensitivity = $6::jsonb, updated_at = now()
       where user_id = $1`,
      [user.id, likedSounds, excludedSounds, defaultGoal, defaultDurationSeconds, JSON.stringify(sensitivity)],
    );

    const evidenceRows: Array<{ kind: string; value: string }> = [
      ...likedSounds.map((value: string) => ({ kind: 'like', value })),
      ...excludedSounds.map((value: string) => ({ kind: 'exclusion', value })),
      { kind: 'default_goal', value: defaultGoal },
      { kind: 'default_duration', value: String(defaultDurationSeconds) },
    ];
    for (const item of evidenceRows) {
      await query(
        `insert into preference_evidence (id, user_id, kind, value, source, stable, details)
         values ($1, $2, $3, $4, 'explicit_profile', true, '{}'::jsonb)`,
        [uid('pref'), user.id, item.kind, item.value],
      );
    }

    res.json(await getSoundProfilePayload(user.id));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/me/preference-evidence/:id', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const evidenceId = String(req.params.id ?? '').trim();
    if (!/^pref_[a-z0-9]{4,32}$/i.test(evidenceId)) {
      res.status(400).json({ error: 'Invalid preference evidence id.' });
      return;
    }
    const existing = await query<any>(
      'select * from preference_evidence where id = $1 and user_id = $2',
      [evidenceId, user.id],
    );
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Preference evidence not found.' });
      return;
    }
    if (row.source === 'explicit_profile') {
      res.status(400).json({ error: 'Edit explicit profile preferences directly instead of removing their evidence.' });
      return;
    }
    await query('delete from preference_evidence where id = $1 and user_id = $2', [evidenceId, user.id]);
    res.json(await getSoundProfilePayload(user.id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/playback-states', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const result = await query<any>(
      `select mix_id, position_seconds, duration_seconds, updated_at
       from device_playback_states where user_id = $1 order by updated_at desc limit 50`,
      [user.id],
    );
    res.json(result.rows.map((row) => ({
      mixId: row.mix_id,
      positionSeconds: Number(row.position_seconds),
      durationSeconds: Number(row.duration_seconds),
      updatedAt: row.updated_at,
    })));
  } catch (error) {
    next(error);
  }
});

app.put('/api/me/playback-states/:mixId', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const mixId = String(req.params.mixId ?? '');
    const mix = await getMixById(mixId);
    if (!mix || (mix.status !== 'published' && mix.creatorId !== user.id)) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    const positionSeconds = Math.max(0, Number(req.body.positionSeconds) || 0);
    const durationSeconds = Math.max(positionSeconds, Number(req.body.durationSeconds) || 0);
    const result = await query<any>(
      `insert into device_playback_states (user_id, mix_id, position_seconds, duration_seconds)
       values ($1, $2, $3, $4)
       on conflict (user_id, mix_id) do update
       set position_seconds = excluded.position_seconds,
         duration_seconds = excluded.duration_seconds,
         updated_at = now()
       returning mix_id, position_seconds, duration_seconds, updated_at`,
      [user.id, mixId, positionSeconds, durationSeconds],
    );
    const row = result.rows[0];
    res.json({
      mixId: row.mix_id,
      positionSeconds: Number(row.position_seconds),
      durationSeconds: Number(row.duration_seconds),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/audio-stems', async (_req, res, next) => {
  try {
    res.json(await getAllStems());
  } catch (error) {
    next(error);
  }
});

app.get('/api/content-catalog', async (_req, res, next) => {
  try {
    const approvedStems = await getAllStems();
    const approvedStemIds = new Set(approvedStems.map((stem: any) => stem.id));
    const recipes = defaultRecipes.map((recipe) => ({
      ...recipe,
      exportReady: recipe.tracks.every((track) => approvedStemIds.has(track.stemId)),
    }));
    res.json({ goals, scenes, recipes });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/content-model', async (_req, res, next) => {
  try {
    res.json(await getUnifiedContentModelSummary());
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/overview', async (_req, res, next) => {
  try {
    const [
      usersByRole,
      usersByTier,
      recentUsers,
      stemsByCategory,
      stemsByQaStatus,
      recentStems,
      mixesByStatus,
      mixesByRenderStatus,
      mixesByGoal,
      topMixes,
      conceptsByDimension,
      sampleConcepts,
      stemMetadataSummary,
      supplyGapJobsByStatus,
      supplyGapCandidatesByStatus,
      openSupplyGaps,
      renderQaSummary,
      userManagementRows,
      playbackRecords,
      preferenceSignals,
      playbackEventSummary,
      funnelSummary,
      voiceQaSummary,
      generationQuotaSignals,
      releaseEligibleAssets,
      discoverEligibleContent,
      recentAssetGovernance,
      contentPipelineItems,
    ] = await Promise.all([
      query<any>('select role as key, count(*)::int as count from users group by role order by role'),
      query<any>('select subscription_tier as key, count(*)::int as count from users group by subscription_tier order by subscription_tier'),
      query<any>(
        `select id, username, email, role, subscription_tier, created_at, updated_at
         from users
         order by created_at desc
         limit 8`,
      ),
      query<any>('select category as key, count(*)::int as count from audio_stems group by category order by category'),
      query<any>('select qa_status as key, count(*)::int as count from audio_stems group by qa_status order by qa_status'),
      query<any>(
        `select id, name, category, audio_url, is_premium, tags, default_volume, description,
                source_platform, source_url, source_item_id, source_creator, license_name, license_url,
                commercial_use_allowed, derivative_use_allowed, attribution_required,
                raw_redistribution_allowed, qa_status, qa_notes, file_sha256, imported_at
         from audio_stems
         order by coalesce(imported_at, now()) desc, name asc
         limit 10`,
      ),
      query<any>('select status as key, count(*)::int as count from mixes group by status order by status'),
      query<any>('select render_status as key, count(*)::int as count from mixes group by render_status order by render_status'),
      query<any>(
        `select coalesce(recipe_data #>> '{audioIntent,goal}', recipe_data #>> '{quickCreate,soundProfileSnapshot,defaultGoal}', 'unknown') as key,
                count(*)::int as count
         from mixes
         group by key
         order by key`,
      ),
      query<any>(
        `select id, creator_id, title, description, cover_image_url, status, recipe_data, render_status,
                rendered_audio_url, rendered_at, render_error, published_version_id,
                plays_count, likes_count, share_clicks, completion_50_count, completion_90_count,
                created_at, updated_at
         from mixes
         order by (plays_count + completion_50_count * 2 + completion_90_count * 3) desc, updated_at desc
         limit 8`,
      ),
      query<any>('select dimension as key, count(*)::int as count from audio_concepts where active = true group by dimension order by dimension'),
      query<any>(
        `select id, parent_id, dimension, name, description, synonyms, active
         from audio_concepts
         where active = true
         order by dimension asc, id asc
         limit 16`,
      ),
      query<any>(
        `select
           count(*)::int as total,
           count(*) filter (where (review->>'reviewStatus') = 'editorial_baseline')::int as editorial_baseline,
           count(*) filter (where (review->>'reviewStatus') = 'catalog_baseline')::int as catalog_baseline
         from stem_metadata_v3`,
      ),
      query<any>('select status as key, count(*)::int as count from supply_gap_jobs group by status order by status'),
      query<any>('select status as key, count(*)::int as count from supply_gap_candidates group by status order by status'),
      query<any>(
        `select id, role, goal, scene, content_mode, phase, request_count, estimated_reuse_score, status, updated_at
         from supply_gaps
         where status in ('open', 'planned', 'sourcing')
         order by request_count desc, estimated_reuse_score desc, updated_at desc
         limit 8`,
      ),
      query<any>(
        `select
           count(*)::int as total,
           count(*) filter (where passed = true)::int as passed,
           count(*) filter (where passed = false)::int as failed
         from render_qa_reports`,
      ),
      query<any>(
        `select u.id, u.username, u.email, u.role, u.subscription_tier, u.created_at, u.updated_at,
                (select count(*)::int from mixes m where m.creator_id = u.id) as saved_sounds,
                (select coalesce(sum(m.plays_count), 0)::int from mixes m where m.creator_id = u.id) as total_plays,
                (select count(*)::int from preference_evidence pe where pe.user_id = u.id) as preference_count,
                (select count(*)::int from preference_evidence pe where pe.user_id = u.id and pe.kind = 'exclusion') as exclusion_count,
                (select count(*)::int from device_playback_states dps where dps.user_id = u.id) as playback_state_count,
                (select max(uh.played_at) from user_history uh where uh.user_id = u.id) as last_played_at
         from users u
         order by u.created_at desc
         limit 20`,
      ),
      query<any>(
        `select uh.user_id, u.username, uh.mix_id, m.title, uh.duration_listened, uh.played_at
         from user_history uh
         join users u on u.id = uh.user_id
         join mixes m on m.id = uh.mix_id
         order by uh.played_at desc
         limit 20`,
      ),
      query<any>(
        `select kind as key, value, count(*)::int as count
         from preference_evidence
         group by kind, value
         order by count desc, kind asc, value asc
         limit 20`,
      ),
      query<any>(
        `select event_type as key, count(*)::int as count
         from playback_events
         group by event_type
         order by event_type`,
      ),
      query<any>(
        `select
           count(*) filter (where event_type = 'quick_create_started')::int as quick_create_started,
           count(*) filter (where event_type = 'recipe_ready')::int as recipe_ready,
           count(*) filter (where event_type = 'playback_started')::int as playback_started,
           count(*) filter (where event_type = 'playback_failed')::int as playback_failed,
           count(*) filter (where event_type = 'result_accepted')::int as result_accepted,
           count(*) filter (where event_type = 'work_saved')::int as work_saved
         from playback_events`,
      ),
      query<any>('select decision as key, count(*)::int as count from voice_qa_reviews group by decision order by decision'),
      query<any>(
        `select
          count(*)::int as ai_sessions,
          count(distinct user_id)::int as ai_users
         from ai_sessions`,
      ),
      query<any>(
        `select count(*)::int as count
         from audio_stems
         where qa_status = 'approved'
           and file_sha256 <> ''
           and commercial_use_allowed = true
           and derivative_use_allowed = true
           and category <> 'Voice'`,
      ),
      query<any>(`select count(*)::int as count from mixes m where ${MIX_DISCOVER_ELIGIBLE_WHERE}`),
      query<any>(
        `select s.id, s.name, s.category, s.qa_status, s.file_sha256,
                s.commercial_use_allowed, s.derivative_use_allowed, s.raw_redistribution_allowed,
                s.license_name, s.imported_at,
                count(distinct sc.concept_id)::int as concept_count,
                count(distinct m.id)::int as content_usage_count
         from audio_stems s
         left join stem_concepts sc on sc.stem_id = s.id and sc.verified = true
         left join mixes m on exists (
           select 1
           from jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) as recipe_track
           where recipe_track->>'stemId' = s.id
         )
         group by s.id
         order by coalesce(s.imported_at, now()) desc, s.name asc
         limit 12`,
      ),
      query<any>(
        `select m.id, m.title, m.status, m.render_status, m.published_version_id,
                coalesce(m.recipe_data #>> '{audioIntent,goal}', 'unknown') as goal,
                coalesce(m.recipe_data #>> '{audioIntent,scene}', 'unknown') as scene,
                count(recipe_track.value->>'stemId')::int as track_count,
                count(s.id) filter (
                  where s.qa_status = 'approved'
                    and s.file_sha256 <> ''
                    and s.commercial_use_allowed = true
                    and s.derivative_use_allowed = true
                    and s.category <> 'Voice'
                )::int as eligible_track_count,
                count(s.id) filter (
                  where s.id is not null
                    and not (
                      s.qa_status = 'approved'
                      and s.file_sha256 <> ''
                      and s.commercial_use_allowed = true
                      and s.derivative_use_allowed = true
                      and s.category <> 'Voice'
                    )
                )::int as blocked_track_count
         from mixes m
         left join lateral jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) as recipe_track(value) on true
         left join audio_stems s on s.id = recipe_track.value->>'stemId'
         group by m.id
         order by (m.status = 'published' and m.render_status = 'ready') desc, m.updated_at desc
         limit 12`,
      ),
    ]);

    const toCounts = (result: any) => Object.fromEntries(result.rows.map((row: any) => [row.key, row.count]));
    const users = recentUsers.rows.map(mapUser);
    const stems = recentStems.rows.map(mapStem);
    const mixes = topMixes.rows.map(mapMix);
    const metadata = stemMetadataSummary.rows[0] ?? { total: 0, editorial_baseline: 0, catalog_baseline: 0 };
    const renderQa = renderQaSummary.rows[0] ?? { total: 0, passed: 0, failed: 0 };
    const funnel = funnelSummary.rows[0] ?? {};
    const quickCreateStarted = Number(funnel.quick_create_started ?? 0);
    const recipeReady = Number(funnel.recipe_ready ?? 0);
    const playbackStarted = Number(funnel.playback_started ?? 0);
    const resultAccepted = Number(funnel.result_accepted ?? 0);
    const workSaved = Number(funnel.work_saved ?? 0);
    const eligibleAssetCount = Number(releaseEligibleAssets.rows[0]?.count ?? 0);
    const discoverEligibleCount = Number(discoverEligibleContent.rows[0]?.count ?? 0);

    res.json({
      generatedAt: new Date().toISOString(),
      users: {
        total: usersByRole.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0),
        byRole: toCounts(usersByRole),
        bySubscriptionTier: toCounts(usersByTier),
        recent: users,
        management: userManagementRows.rows.map((row: any) => ({
          id: row.id,
          username: row.username,
          email: row.email,
          role: row.role,
          subscriptionTier: row.subscription_tier,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          savedSounds: Number(row.saved_sounds ?? 0),
          totalPlays: Number(row.total_plays ?? 0),
          preferenceCount: Number(row.preference_count ?? 0),
          exclusionCount: Number(row.exclusion_count ?? 0),
          playbackStateCount: Number(row.playback_state_count ?? 0),
          lastPlayedAt: row.last_played_at ?? null,
        })),
        playbackRecords: playbackRecords.rows.map((row: any) => ({
          userId: row.user_id,
          username: row.username,
          mixId: row.mix_id,
          title: row.title,
          durationListened: Number(row.duration_listened ?? 0),
          playedAt: row.played_at,
        })),
      },
      products: {
        totalMixes: mixesByStatus.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0),
        byStatus: toCounts(mixesByStatus),
        byRenderStatus: toCounts(mixesByRenderStatus),
        byGoal: toCounts(mixesByGoal),
        topMixes: mixes,
        goals,
        scenes,
        defaultRecipes: defaultRecipes.map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          goal: recipe.goal,
          scene: recipe.scene,
          contentMode: recipe.contentMode,
          durationSeconds: recipe.durationSeconds,
          trackCount: recipe.tracks.length,
        })),
      },
      assets: {
        total: stemsByQaStatus.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0),
        byCategory: toCounts(stemsByCategory),
        byQaStatus: toCounts(stemsByQaStatus),
        recent: stems,
      },
      knowledge: {
        conceptCount: conceptsByDimension.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0),
        byDimension: toCounts(conceptsByDimension),
        metadataSummary: {
          total: Number(metadata.total ?? 0),
          editorialBaseline: Number(metadata.editorial_baseline ?? 0),
          catalogBaseline: Number(metadata.catalog_baseline ?? 0),
        },
        sampleConcepts: sampleConcepts.rows.map((row: any) => ({
          id: row.id,
          parentId: row.parent_id,
          dimension: row.dimension,
          name: row.name,
          description: row.description,
          synonyms: row.synonyms ?? [],
          active: row.active,
        })),
      },
      operations: {
        contentPipeline: {
          principles: [
            '素材库是唯一音频文件入口。',
            '知识库只定义概念、同义词、风险与匹配规则。',
            '内容生产/审核把 approved 素材组合成可发布声景。',
            '发现页只编排已发布、已渲染、可复播的内容。',
          ],
          summary: {
            totalAssets: stemsByQaStatus.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0),
            releaseEligibleAssets: eligibleAssetCount,
            blockedAssets: Math.max(0, stemsByQaStatus.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0) - eligibleAssetCount),
            semanticMetadata: Number(metadata.total ?? 0),
            discoverEligibleContent: discoverEligibleCount,
            openProductionGaps: openSupplyGaps.rows.length,
          },
          assetGovernance: recentAssetGovernance.rows.map((row: any) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            qaStatus: row.qa_status,
            licenseName: row.license_name,
            conceptCount: Number(row.concept_count ?? 0),
            contentUsageCount: Number(row.content_usage_count ?? 0),
            releaseEligible: releaseBlockersForStemRow(row).length === 0,
            blockers: releaseBlockersForStemRow(row),
          })),
          contentItems: contentPipelineItems.rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            renderStatus: row.render_status,
            publishedVersionId: row.published_version_id ?? null,
            goal: row.goal,
            scene: row.scene,
            trackCount: Number(row.track_count ?? 0),
            eligibleTrackCount: Number(row.eligible_track_count ?? 0),
            blockedTrackCount: Number(row.blocked_track_count ?? 0),
            discoverEligible: row.status === 'published' && row.render_status === 'ready' && Boolean(row.published_version_id) && Number(row.blocked_track_count ?? 0) === 0,
          })),
        },
        supplyGapJobsByStatus: toCounts(supplyGapJobsByStatus),
        supplyGapCandidatesByStatus: toCounts(supplyGapCandidatesByStatus),
        openSupplyGaps: openSupplyGaps.rows.map((row: any) => ({
          id: row.id,
          role: row.role,
          goal: row.goal,
          scene: row.scene,
          contentMode: row.content_mode,
          phase: row.phase,
          requestCount: row.request_count,
          estimatedReuseScore: Number(row.estimated_reuse_score),
          status: row.status,
          updatedAt: row.updated_at,
        })),
        renderQa: {
          total: Number(renderQa.total ?? 0),
          passed: Number(renderQa.passed ?? 0),
          failed: Number(renderQa.failed ?? 0),
        },
        voiceQaByDecision: toCounts(voiceQaSummary),
      },
      analytics: {
        playbackEventsByType: toCounts(playbackEventSummary),
        funnel: {
          quickCreateStarted,
          recipeReady,
          playbackStarted,
          playbackFailed: Number(funnel.playback_failed ?? 0),
          resultAccepted,
          workSaved,
          generationSuccessRate: quickCreateStarted > 0 ? recipeReady / quickCreateStarted : 0,
          saveRate: quickCreateStarted > 0 ? workSaved / quickCreateStarted : 0,
          acceptanceRate: playbackStarted > 0 ? resultAccepted / playbackStarted : 0,
        },
        preferenceSignals: preferenceSignals.rows.map((row: any) => ({
          kind: row.key,
          value: row.value,
          count: Number(row.count ?? 0),
        })),
        generationQuotaSignals: {
          aiSessions: Number(generationQuotaSignals.rows[0]?.ai_sessions ?? 0),
          aiUsers: Number(generationQuotaSignals.rows[0]?.ai_users ?? 0),
        },
      },
      system: {
        releaseChannel: productCapabilities.releaseChannel,
        guidedVoiceEnabled: productCapabilities.guidedVoice,
        production: runtimeConfig.production,
        storageDriver: storageConfig.driver,
        corsOriginCount: runtimeConfig.corsAllowedOrigins.size,
        rateLimits: {
          generalPerMinute: 240,
          quickCreatePerMinute: 10,
          aiSessionsPerMinute: 10,
          musicGenerationPerMinute: 5,
        },
        providerStatus: {
          aiRecipe: getAiRecipeStatus(),
          lyriaConfigured: Boolean(process.env.LYRIA_PROVIDER_ENABLED === 'true' || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT),
          ttsConfigured: Boolean(process.env.TTS_PROVIDER || process.env.ELEVENLABS_API_KEY),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/knowledge', async (req, res, next) => {
  try {
    const queryText = String(req.query.query ?? '').trim().toLowerCase();
    const requestedDimension = String(req.query.dimension ?? '').trim();
    const requestedConceptId = String(req.query.conceptId ?? '').trim();
    const filters = ['c.active = true'];
    const params: unknown[] = [];
    if (requestedDimension) {
      params.push(requestedDimension);
      filters.push(`c.dimension = $${params.length}`);
    }
    if (queryText) {
      params.push(`%${queryText}%`);
      filters.push(`(lower(c.id) like $${params.length} or lower(c.name) like $${params.length} or lower(c.description) like $${params.length} or exists (select 1 from unnest(c.synonyms) as synonym where lower(synonym) like $${params.length}))`);
    }
    const where = filters.join(' and ');
    const mapKnowledgeConcept = (row: any) => ({
      id: row.id,
      parentId: row.parent_id,
      dimension: row.dimension,
      name: row.name,
      description: row.description,
      synonyms: row.synonyms ?? [],
      active: row.active,
      childCount: Number(row.child_count ?? 0),
      verifiedAssetCount: Number(row.verified_asset_count ?? 0),
      candidateAssetCount: Number(row.candidate_asset_count ?? 0),
    });
    const [dimensions, concepts] = await Promise.all([
      query<any>('select dimension as key, count(*)::int as count from audio_concepts where active = true group by dimension order by dimension'),
      query<any>(
        `select c.id, c.parent_id, c.dimension, c.name, c.description, c.synonyms, c.active,
                (select count(*)::int from audio_concepts child where child.parent_id = c.id and child.active = true) as child_count,
                count(distinct sc.stem_id) filter (where sc.verified = true)::int as verified_asset_count,
                count(distinct sc.stem_id) filter (where sc.verified = false)::int as candidate_asset_count
         from audio_concepts c
         left join stem_concepts sc on sc.concept_id = c.id
         where ${where}
         group by c.id
         order by c.dimension asc, coalesce(c.parent_id, c.id) asc, c.id asc
         limit 240`,
        params,
      ),
    ]);
    const conceptRows = concepts.rows.map(mapKnowledgeConcept);
    const selectedId = requestedConceptId || conceptRows[0]?.id || '';
    let selectedConcept = null;
    if (selectedId) {
      const [selected, children, linkedAssets] = await Promise.all([
        query<any>(
          `select c.id, c.parent_id, c.dimension, c.name, c.description, c.synonyms, c.active,
                  (select count(*)::int from audio_concepts child where child.parent_id = c.id and child.active = true) as child_count,
                  count(distinct sc.stem_id) filter (where sc.verified = true)::int as verified_asset_count,
                  count(distinct sc.stem_id) filter (where sc.verified = false)::int as candidate_asset_count
           from audio_concepts c
           left join stem_concepts sc on sc.concept_id = c.id
           where c.id = $1
           group by c.id`,
          [selectedId],
        ),
        query<any>(
          `select c.id, c.parent_id, c.dimension, c.name, c.description, c.synonyms, c.active,
                  (select count(*)::int from audio_concepts child where child.parent_id = c.id and child.active = true) as child_count,
                  count(distinct sc.stem_id) filter (where sc.verified = true)::int as verified_asset_count,
                  count(distinct sc.stem_id) filter (where sc.verified = false)::int as candidate_asset_count
           from audio_concepts c
           left join stem_concepts sc on sc.concept_id = c.id
           where c.parent_id = $1 and c.active = true
           group by c.id
           order by c.id asc`,
          [selectedId],
        ),
        query<any>(
          `select s.id, s.name, s.category, s.qa_status, s.file_sha256,
                  s.commercial_use_allowed, s.derivative_use_allowed, s.raw_redistribution_allowed,
                  sc.source, sc.confidence, sc.verified
           from stem_concepts sc
           join audio_stems s on s.id = sc.stem_id
           where sc.concept_id = $1
           order by sc.verified desc, s.qa_status asc, s.name asc
           limit 120`,
          [selectedId],
        ),
      ]);
      if (selected.rows[0]) {
        selectedConcept = {
          ...mapKnowledgeConcept(selected.rows[0]),
          children: children.rows.map(mapKnowledgeConcept),
          linkedAssets: linkedAssets.rows.map((row: any) => {
            const blockers = releaseBlockersForStemRow(row);
            return {
              id: row.id,
              name: row.name,
              category: row.category,
              qaStatus: row.qa_status,
              source: row.source,
              confidence: Number(row.confidence ?? 0),
              verified: Boolean(row.verified),
              releaseEligible: blockers.length === 0,
              blockers,
            };
          }),
        };
      }
    }
    res.json({
      generatedAt: new Date().toISOString(),
      dimensions: Object.fromEntries(dimensions.rows.map((row: any) => [row.key, row.count])),
      concepts: conceptRows,
      selectedConcept,
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/knowledge/concepts/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const name = cleanDiscoverText(req.body?.name, '', 90);
    const description = cleanDiscoverText(req.body?.description, '', 420);
    const synonyms = Array.isArray(req.body?.synonyms)
      ? req.body.synonyms.map((item: unknown) => cleanDiscoverText(item, '', 60)).filter(Boolean).slice(0, 24)
      : [];
    const active = req.body?.active !== false;
    if (!id || !name) {
      res.status(400).json({ error: 'Concept id and name are required.' });
      return;
    }
    const updated = await query<any>(
      `update audio_concepts
       set name = $2, description = $3, synonyms = $4, active = $5, updated_at = now()
       where id = $1
       returning id, parent_id, dimension, name, description, synonyms, active`,
      [id, name, description, synonyms, active],
    );
    if (updated.rows.length === 0) {
      res.status(404).json({ error: 'Knowledge concept not found.' });
      return;
    }
    const row = updated.rows[0];
    res.json({
      concept: {
        id: row.id,
        parentId: row.parent_id,
        dimension: row.dimension,
        name: row.name,
        description: row.description,
        synonyms: row.synonyms ?? [],
        active: row.active,
        childCount: 0,
        verifiedAssetCount: 0,
        candidateAssetCount: 0,
        children: [],
        linkedAssets: [],
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/content-demand-coverage', async (_req, res, next) => {
  try {
    const config = await loadDiscoverConfig();
    const [mixes, stems] = await Promise.all([
      query<any>(
        `select m.id, m.title, m.description, m.status, m.render_status, m.published_version_id,
                coalesce(m.recipe_data #>> '{audioIntent,goal}', m.recipe_data #>> '{quickCreate,soundProfileSnapshot,defaultGoal}', 'unknown') as goal,
                coalesce(m.recipe_data #>> '{audioIntent,scene}', 'unknown') as scene,
                coalesce(m.recipe_data #>> '{audioIntent,contentMode}', 'pure_soundscape') as content_mode,
                count(recipe_track.value->>'stemId')::int as track_count,
                count(s.id) filter (
                  where s.qa_status = 'approved'
                    and s.file_sha256 <> ''
                    and s.commercial_use_allowed = true
                    and s.derivative_use_allowed = true
                    and s.category <> 'Voice'
                )::int as eligible_track_count,
                count(s.id) filter (
                  where s.id is not null
                    and not (
                      s.qa_status = 'approved'
                      and s.file_sha256 <> ''
                      and s.commercial_use_allowed = true
                      and s.derivative_use_allowed = true
                      and s.category <> 'Voice'
                    )
                )::int as blocked_track_count,
                coalesce(array_agg(distinct s.category) filter (where s.category is not null), '{}') as track_categories
         from mixes m
         left join lateral jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) as recipe_track(value) on true
         left join audio_stems s on s.id = recipe_track.value->>'stemId'
         group by m.id
         order by (m.status = 'published' and m.render_status = 'ready' and m.published_version_id is not null) desc, m.updated_at desc
         limit 500`,
      ),
      query<any>(
        `select id, name, category, qa_status, tags, description, file_sha256,
                commercial_use_allowed, derivative_use_allowed
         from audio_stems
         order by (qa_status = 'approved') desc, imported_at desc nulls last, name asc
         limit 800`,
      ),
    ]);

    res.json(buildDemandCoverage(config, mixes.rows, stems.rows));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/demand-production-review', async (req, res, next) => {
  try {
    const requestedBatchId = String(req.query.batchId ?? '').trim();
    const batchResult = requestedBatchId
      ? { rows: [{ batch_id: requestedBatchId }] }
      : await query<any>(
        `select recipe_data #>> '{audit,demandProductionBatch,batchId}' as batch_id
         from mixes
         where recipe_data #>> '{audit,demandProductionBatch,batchId}' <> ''
         order by updated_at desc
         limit 1`,
      );
    const batchId = batchResult.rows[0]?.batch_id ?? '';
    if (!batchId) {
      res.json({ batchId: '', generatedAt: new Date().toISOString(), summary: { total: 0, machineReady: 0, humanPassed: 0, needsRework: 0, rejected: 0 }, items: [] });
      return;
    }
    const rows = await query<any>(
      `select m.id, m.title, m.description, m.status, m.render_status, m.rendered_audio_url,
              m.published_version_id, m.recipe_data, m.updated_at,
              qa.duration_seconds, qa.peak_db, qa.integrated_lufs, qa.true_peak_db,
              qa.abnormal_silence_count, qa.passed as machine_passed, qa.created_at as qa_created_at
       from mixes m
       left join lateral (
         select *
         from render_qa_reports q
         where q.mix_id = m.id
         order by q.created_at desc
         limit 1
       ) qa on true
       where m.recipe_data #>> '{audit,demandProductionBatch,batchId}' = $1
       order by m.id`,
      [batchId],
    );
    const items = await Promise.all(rows.rows.map(async (row: any) => {
      const recipe = row.recipe_data ?? {};
      const batch = recipe.audit?.demandProductionBatch ?? {};
      const releaseGovernance = recipe.audit?.demandProductionReleaseGovernance ?? null;
      const review = recipe.audit?.demandProductionReview ?? null;
      const releaseBlockers = releaseGovernance?.state === 'published_release_ready'
        ? []
        : await demandProductionReleaseBlockers(row);
      return {
        mixId: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        renderStatus: row.render_status,
        renderedAudioUrl: row.rendered_audio_url,
        publishedVersionId: row.published_version_id,
        goal: recipe.audioIntent?.goal ?? '',
        scene: recipe.audioIntent?.scene ?? '',
        contentMode: recipe.audioIntent?.contentMode ?? recipe.contentMode ?? '',
        durationSeconds: Number(recipe.durationSeconds ?? row.duration_seconds ?? 0),
        trackCount: Array.isArray(recipe.tracks) ? recipe.tracks.length : 0,
        approvalState: batch.approvalState ?? '',
        sourceMixId: batch.sourceMixId ?? '',
        materialStemId: batch.materialStemId ?? '',
        planId: batch.planId ?? '',
        demandTypeId: batch.demandTypeId ?? '',
        releaseEligible: releaseBlockers.length === 0,
        releaseBlockers,
        releaseGovernance: releaseGovernance ? {
          state: releaseGovernance.state ?? '',
          releasedAt: releaseGovernance.releasedAt ?? '',
          discoverBoundary: releaseGovernance.discoverBoundary ?? '',
        } : null,
        machineQa: row.qa_created_at ? {
          durationSeconds: Number(row.duration_seconds ?? 0),
          peakDb: row.peak_db === null ? null : Number(row.peak_db),
          integratedLufs: row.integrated_lufs === null ? null : Number(row.integrated_lufs),
          truePeakDb: row.true_peak_db === null ? null : Number(row.true_peak_db),
          abnormalSilenceCount: Number(row.abnormal_silence_count ?? 0),
          passed: Boolean(row.machine_passed),
          createdAt: row.qa_created_at,
        } : null,
        humanReview: review ? {
          decision: review.decision,
          notes: review.notes ?? '',
          reviewedAt: review.reviewedAt ?? '',
        } : null,
      };
    }));
    const humanPassed = items.filter((item) => item.humanReview?.decision === 'passed').length;
    const needsRework = items.filter((item) => item.humanReview?.decision === 'needs_rework').length;
    const rejected = items.filter((item) => item.humanReview?.decision === 'rejected').length;
    res.json({
      batchId,
      generatedAt: new Date().toISOString(),
      summary: {
        total: items.length,
        machineReady: items.filter((item) => item.renderStatus === 'ready' && item.machineQa?.passed).length,
        humanPassed,
        needsRework,
        rejected,
        releaseEligible: items.filter((item) => item.releaseEligible).length,
        released: items.filter((item) => item.releaseGovernance?.state === 'published_release_ready').length,
      },
      policy: 'Human pass only marks a private release candidate. Release governance can publish it into the Discover-eligible pool, but Discover placement still requires separate configuration.',
      items,
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/demand-production-review/:mixId', async (req, res, next) => {
  try {
    const mixId = String(req.params.mixId ?? '').trim();
    const decision = String(req.body?.decision ?? '').trim();
    if (!['passed', 'needs_rework', 'rejected'].includes(decision)) {
      res.status(400).json({ error: 'decision must be passed, needs_rework, or rejected.' });
      return;
    }
    const notes = cleanDiscoverText(req.body?.notes, '', 1000);
    const result = await query<any>(
      `select id, recipe_data, status, render_status, rendered_audio_url
       from mixes
       where id = $1
         and recipe_data #>> '{audit,demandProductionBatch,batchId}' <> ''`,
      [mixId],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Demand production candidate not found.' });
      return;
    }
    if (decision === 'passed' && (row.status !== 'private' || row.render_status !== 'ready' || !row.rendered_audio_url)) {
      res.status(422).json({ error: 'Only private, rendered, machine-ready candidates can pass human review.' });
      return;
    }
    const recipe = row.recipe_data ?? {};
    const nextApprovalState = decision === 'passed'
      ? 'human_passed_release_candidate'
      : decision === 'needs_rework'
        ? 'human_requested_rework'
        : 'human_rejected';
    const nextRecipe = {
      ...recipe,
      audit: {
        ...(recipe.audit ?? {}),
        demandProductionBatch: {
          ...(recipe.audit?.demandProductionBatch ?? {}),
          approvalState: nextApprovalState,
          publicReleaseAllowed: false,
          discoverPlacementAllowed: false,
        },
        demandProductionReview: {
          decision,
          notes,
          reviewedAt: new Date().toISOString(),
          releaseBoundary: 'private_candidate_only_release_governance_required',
        },
      },
    };
    const updated = await query<any>(
      `update mixes
       set recipe_data = $2::jsonb, updated_at = now()
       where id = $1
       returning id, title, status, render_status, rendered_audio_url, recipe_data`,
      [mixId, JSON.stringify(nextRecipe)],
    );
    res.json({
      mixId,
      decision,
      approvalState: nextApprovalState,
      candidate: {
        id: updated.rows[0].id,
        title: updated.rows[0].title,
        status: updated.rows[0].status,
        renderStatus: updated.rows[0].render_status,
        renderedAudioUrl: updated.rows[0].rendered_audio_url,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/demand-production-review/:mixId/release-governance', async (req, res, next) => {
  try {
    const mixId = String(req.params.mixId ?? '').trim();
    const result = await query<any>(
      `select m.id, m.title, m.description, m.status, m.render_status, m.rendered_audio_url,
              m.published_version_id, m.recipe_data, m.updated_at,
              qa.passed as machine_passed, qa.created_at as qa_created_at
       from mixes m
       left join lateral (
         select *
         from render_qa_reports q
         where q.mix_id = m.id
         order by q.created_at desc
         limit 1
       ) qa on true
       where m.id = $1
         and m.recipe_data #>> '{audit,demandProductionBatch,batchId}' <> ''`,
      [mixId],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Demand production candidate not found.' });
      return;
    }
    const blockers = await demandProductionReleaseBlockers(row);
    if (blockers.length > 0) {
      res.status(422).json({ error: 'Demand production candidate failed release governance.', blockers });
      return;
    }
    const recipe = row.recipe_data ?? {};
    const releasedAt = new Date().toISOString();
    const nextRecipe = {
      ...recipe,
      audit: {
        ...(recipe.audit ?? {}),
        demandProductionBatch: {
          ...(recipe.audit?.demandProductionBatch ?? {}),
          approvalState: 'release_governance_passed',
          publicReleaseAllowed: true,
          discoverPlacementAllowed: true,
        },
        demandProductionReleaseGovernance: {
          state: 'published_release_ready',
          releasedAt,
          releasedBy: cleanDiscoverText(req.body?.releasedBy, 'admin', 80),
          discoverBoundary: 'eligible_pool_only_not_auto_bound_to_discover_config',
          gates: [
            'human_listening_passed',
            'machine_render_qa_passed',
            'recipe_v2_frozen',
            'rendered_audio_ready',
            'audible_stems_approved_rights_confirmed',
            'voice_free_beta_public_boundary',
          ],
        },
      },
    };
    const updated = await query<any>(
      `update mixes
       set status = 'published', recipe_data = $2::jsonb, updated_at = now()
       where id = $1
       returning id, title, status, render_status, rendered_audio_url, published_version_id, recipe_data`,
      [mixId, JSON.stringify(nextRecipe)],
    );
    res.json({
      mixId,
      status: updated.rows[0].status,
      renderStatus: updated.rows[0].render_status,
      publishedVersionId: updated.rows[0].published_version_id,
      approvalState: 'release_governance_passed',
      discoverBoundary: 'eligible_pool_only_not_auto_bound_to_discover_config',
      discoverPlacementAllowed: true,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/assets', async (req, res, next) => {
  try {
    const status = String(req.query.status ?? '').trim();
    const category = String(req.query.category ?? '').trim();
    const search = String(req.query.query ?? '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 500));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (status && ['candidate', 'approved', 'needs_review', 'rejected'].includes(status)) {
      params.push(status);
      clauses.push(`qa_status = $${params.length}`);
    }
    if (category && allowedUploadCategories.has(category)) {
      params.push(category);
      clauses.push(`category = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      clauses.push(`(
        lower(id) like $${params.length}
        or lower(name) like $${params.length}
        or lower(description) like $${params.length}
        or lower(audio_url) like $${params.length}
        or lower(license_name) like $${params.length}
        or exists (select 1 from unnest(tags) as tag where lower(tag) like $${params.length})
      )`);
    }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const countResult = await query<any>(`select count(*)::int as total from audio_stems ${where}`, params);
    const rowsResult = await query<any>(
      `select * from audio_stems
       ${where}
       order by imported_at desc nulls last, name asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    );
    res.json({
      assets: rowsResult.rows.map(mapStem),
      pagination: {
        total: Number(countResult.rows[0]?.total ?? 0),
        limit,
        offset,
        hasMore: offset + rowsResult.rows.length < Number(countResult.rows[0]?.total ?? 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/assets/import-inbox', async (_req, res, next) => {
  try {
    const files = await scanAdminImportAudioFiles();
    res.json({
      rootPath: ADMIN_IMPORT_ROOT,
      folderPlan: adminImportFolderPlan,
      manifestTemplate: adminImportManifestTemplate,
      shelves: summarizeAdminImportShelves(files),
      files,
      summary: {
        total: files.length,
        ready: files.filter((file) => file.status === 'ready').length,
        duplicate: files.filter((file) => file.status === 'duplicate').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/assets/import-inbox', async (req, res, next) => {
  try {
    const selectedPaths = Array.isArray(req.body?.paths) ? new Set(req.body.paths.map(String)) : null;
    const scanned = await scanAdminImportAudioFiles();
    const candidates = scanned.filter((file) => file.status === 'ready' && (!selectedPaths || selectedPaths.has(file.relativePath)));
    const dateKey = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(PUBLIC_DIR, 'audio', 'uploads', 'admin', dateKey);
    await mkdir(outputDir, { recursive: true });
    const imported = [];
    const skipped = scanned
      .filter((file) => file.status !== 'ready' || (selectedPaths && !selectedPaths.has(file.relativePath)))
      .map((file) => ({
        relativePath: file.relativePath,
        reason: file.status === 'duplicate' ? `重复 hash，已存在 ${file.existingStemId}` : '未选择',
        existingStemId: file.existingStemId,
      }));

    for (const file of candidates) {
      const sourcePath = path.resolve(ADMIN_IMPORT_ROOT, file.relativePath);
      if (!sourcePath.startsWith(ADMIN_IMPORT_ROOT)) {
        skipped.push({ relativePath: file.relativePath, reason: '路径不安全', existingStemId: null });
        continue;
      }
      const ext = path.extname(file.relativePath).toLowerCase();
      const filename = `${safeAssetSlug(file.suggestion.name)}-${file.suggestion.fileSha256.slice(0, 10)}${ext}`;
      const outputPath = path.join(outputDir, filename);
      const audioUrl = `/audio/uploads/admin/${dateKey}/${filename}`;
      await copyFile(sourcePath, outputPath);
      const tags = file.suggestion.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12);
      const id = `stem_import_${safeAssetSlug(file.suggestion.category)}_${safeAssetSlug(file.suggestion.name)}_${file.suggestion.fileSha256.slice(0, 10)}`;
      const result = await query<any>(
        `insert into audio_stems (
           id, name, category, audio_url, is_premium, tags, default_volume, description,
           source_platform, source_url, source_item_id, source_creator,
           license_name, license_url, commercial_use_allowed, derivative_use_allowed,
           attribution_required, raw_redistribution_allowed, qa_status, qa_notes,
           file_sha256, imported_at
         ) values (
           $1, $2, $3, $4, false, $5, $6, $7,
           $8, $9, $10, $11,
           $12, $13, $14, $15,
           $16, $17, 'needs_review', $18,
           $19, now()
         )
         on conflict (id) do update set
           name = excluded.name,
           category = excluded.category,
           audio_url = excluded.audio_url,
           tags = excluded.tags,
           default_volume = excluded.default_volume,
           description = excluded.description,
           source_platform = excluded.source_platform,
           source_url = excluded.source_url,
           source_item_id = excluded.source_item_id,
           source_creator = excluded.source_creator,
           license_name = excluded.license_name,
           license_url = excluded.license_url,
           commercial_use_allowed = excluded.commercial_use_allowed,
           derivative_use_allowed = excluded.derivative_use_allowed,
           attribution_required = excluded.attribution_required,
           raw_redistribution_allowed = excluded.raw_redistribution_allowed,
           qa_status = 'needs_review',
           qa_notes = excluded.qa_notes,
           file_sha256 = excluded.file_sha256,
           imported_at = now()
         returning *`,
        [
          id,
          file.suggestion.name,
          file.suggestion.category,
          audioUrl,
          tags,
          Math.max(0, Math.min(100, Math.round(Number(file.suggestion.defaultVolume) || 60))),
          String(file.suggestion.description || 'Batch imported candidate awaiting rights, machine QA, and listening QA.').slice(0, 700),
          String(file.suggestion.sourcePlatform || '后台批量导入').slice(0, 120),
          String(file.suggestion.sourceUrl || '').slice(0, 500),
          `admin-import:${file.relativePath}`.slice(0, 120),
          String(file.suggestion.sourceCreator || '').slice(0, 160),
          String(file.suggestion.licenseName || '待确认授权').slice(0, 160),
          String(file.suggestion.licenseUrl || '').slice(0, 500),
          Boolean(file.suggestion.commercialUseAllowed),
          Boolean(file.suggestion.derivativeUseAllowed),
          Boolean(file.suggestion.attributionRequired),
          Boolean(file.suggestion.rawRedistributionAllowed),
          `Admin batch import from ${file.relativePath} on ${new Date().toISOString()}. Defaulted to needs_review; must pass rights, machine QA, and listening QA before approval.`,
          file.suggestion.fileSha256,
        ],
      );
      imported.push({ relativePath: file.relativePath, asset: mapStem(result.rows[0]) });
    }
    res.status(201).json({
      imported,
      skipped,
      summary: {
        imported: imported.length,
        skipped: skipped.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

const ADMIN_RESUMABLE_PART_BYTES = 8 * 1024 * 1024;
const ADMIN_RESUMABLE_MAX_BYTES = 2 * 1024 * 1024 * 1024;

const getOwnedUploadSession = async (sessionId: string, userId: string) => {
  const result = await query<any>(
    'select * from asset_upload_sessions where id = $1 and user_id = $2',
    [sessionId, userId],
  );
  return result.rows[0] ?? null;
};

const mapUploadSession = async (session: any) => {
  let parts: Array<{ partNumber: number; etag: string; bytes: number }> = [];
  if (session.status === 'uploading') {
    parts = await exportStorage.listMultipartParts(session.object_key, session.upload_id);
  }
  const fileSize = Number(session.file_size);
  return {
    id: session.id,
    filename: session.original_filename,
    fileSize,
    contentType: session.content_type,
    partSize: Number(session.part_size),
    totalParts: Math.ceil(fileSize / Number(session.part_size)),
    status: session.status,
    uploadedParts: parts.map((part) => ({ partNumber: part.partNumber, bytes: part.bytes })),
    uploadedBytes: session.status === 'completed' || session.status === 'finalizing'
      ? fileSize
      : parts.reduce((total, part) => total + part.bytes, 0),
    audioUrl: session.status === 'completed' ? `/${session.object_key}` : '',
    updatedAt: session.updated_at,
  };
};

const hashPublicStorageObject = async (objectKey: string, expectedBytes: number) => {
  const url = `${storageConfig.publicBaseUrl}/${objectKey}?finalize=${Date.now()}`;
  let response: Response | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      response = await fetch(`${url}-${attempt}`, { headers: { 'Cache-Control': 'no-cache' } });
      if (response.ok && response.body) break;
    } catch {
      response = null;
    }
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
  if (!response?.ok || !response.body) throw new Error('Completed upload is not readable from object storage.');
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of Readable.fromWeb(response.body as any)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buffer);
    bytes += buffer.length;
  }
  if (bytes !== expectedBytes) throw new Error(`Completed upload size mismatch: expected ${expectedBytes}, received ${bytes}.`);
  return hash.digest('hex');
};

app.post('/api/admin/assets/resumable', async (req, res, next) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) return;
    const resumeSessionId = String(req.body?.resumeSessionId ?? '').trim();
    if (resumeSessionId) {
      const resumed = await getOwnedUploadSession(resumeSessionId, user.id);
      if (resumed && ['uploading', 'finalizing', 'completed'].includes(resumed.status)) {
        res.json({ session: await mapUploadSession(resumed) });
        return;
      }
    }
    if (storageConfig.driver !== 's3') {
      res.status(503).json({ error: 'Resumable uploads require object storage.' });
      return;
    }
    const originalName = path.basename(String(req.body?.filename ?? '')).slice(0, 240);
    const ext = path.extname(originalName).toLowerCase();
    const fileSize = Number(req.body?.fileSize);
    if (!originalName || !allowedAudioUploadExtensions.has(ext)) {
      res.status(400).json({ error: 'Unsupported audio type. Upload MP3, WAV, M4A, AAC, OGG, or FLAC.' });
      return;
    }
    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > ADMIN_RESUMABLE_MAX_BYTES) {
      res.status(400).json({ error: 'File size must be between 1 byte and 2 GB.' });
      return;
    }
    const sessionId = uid('assetupload');
    const dateKey = new Date().toISOString().slice(0, 10);
    const title = String(req.body?.metadata?.name || originalName.replace(/\.[^.]+$/, '')).trim().slice(0, 140);
    const filename = `${safeAssetSlug(title)}-${sessionId.slice(-8)}${ext}`;
    const objectKey = `audio/uploads/admin/${dateKey}/${filename}`;
    const contentType = contentTypeForAudioExt(ext);
    const uploadId = await exportStorage.createMultipartUpload(objectKey, contentType);
    const result = await query<any>(
      `insert into asset_upload_sessions (
         id, user_id, upload_id, object_key, original_filename, content_type,
         file_size, part_size, status, metadata
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'uploading', $9::jsonb)
       returning *`,
      [
        sessionId,
        user.id,
        uploadId,
        objectKey,
        originalName,
        contentType,
        fileSize,
        ADMIN_RESUMABLE_PART_BYTES,
        JSON.stringify({ ...(req.body?.metadata ?? {}), lastModified: Number(req.body?.lastModified) || 0 }),
      ],
    );
    res.status(201).json({ session: await mapUploadSession(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/assets/resumable/:sessionId', async (req, res, next) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) return;
    const session = await getOwnedUploadSession(String(req.params.sessionId), user.id);
    if (!session) {
      res.status(404).json({ error: 'Upload session not found.' });
      return;
    }
    res.json({ session: await mapUploadSession(session) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/assets/resumable/:sessionId/parts/:partNumber', async (req, res, next) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) return;
    const session = await getOwnedUploadSession(String(req.params.sessionId), user.id);
    if (!session) {
      res.status(404).json({ error: 'Upload session not found.' });
      return;
    }
    if (session.status !== 'uploading') {
      res.status(409).json({ error: `Upload session is ${session.status}.` });
      return;
    }
    const partNumber = Number(req.params.partNumber);
    const fileSize = Number(session.file_size);
    const partSize = Number(session.part_size);
    const totalParts = Math.ceil(fileSize / partSize);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > totalParts) {
      res.status(400).json({ error: 'Invalid multipart part number.' });
      return;
    }
    const expectedBytes = partNumber === totalParts ? fileSize - partSize * (totalParts - 1) : partSize;
    const body = await collectRawRequestBody(req, expectedBytes + 1);
    if (body.length !== expectedBytes) {
      res.status(400).json({ error: `Part ${partNumber} must contain exactly ${expectedBytes} bytes.` });
      return;
    }
    const part = await exportStorage.uploadMultipartPart(session.object_key, session.upload_id, partNumber, body);
    await query('update asset_upload_sessions set updated_at = now() where id = $1', [session.id]);
    res.json({ part: { partNumber: part.partNumber, bytes: part.bytes } });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post('/api/admin/assets/resumable/:sessionId/complete', async (req, res, next) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) return;
    let session = await getOwnedUploadSession(String(req.params.sessionId), user.id);
    if (!session) {
      res.status(404).json({ error: 'Upload session not found.' });
      return;
    }
    if (session.status === 'completed') {
      const duplicateStemId = String(session.metadata?.duplicateStemId ?? '');
      const existing = duplicateStemId
        ? await query<any>('select * from audio_stems where id = $1', [duplicateStemId])
        : await query<any>('select * from audio_stems where audio_url = $1', [`/${session.object_key}`]);
      res.json({ session: await mapUploadSession(session), asset: existing.rows[0] ? mapStem(existing.rows[0]) : null });
      return;
    }
    if (session.status === 'uploading') {
      const parts = await exportStorage.listMultipartParts(session.object_key, session.upload_id);
      const fileSize = Number(session.file_size);
      const expectedParts = Math.ceil(fileSize / Number(session.part_size));
      if (parts.length !== expectedParts || parts.reduce((total, part) => total + part.bytes, 0) !== fileSize) {
        res.status(409).json({ error: 'Upload is incomplete.', uploadedParts: parts.map((part) => part.partNumber) });
        return;
      }
      await exportStorage.completeMultipartUpload(session.object_key, session.upload_id, parts);
      const updated = await query<any>(
        `update asset_upload_sessions set status = 'finalizing', updated_at = now() where id = $1 returning *`,
        [session.id],
      );
      session = updated.rows[0];
    }
    if (session.status !== 'finalizing') {
      res.status(409).json({ error: `Upload session is ${session.status}.` });
      return;
    }
    const fileSha256 = await hashPublicStorageObject(session.object_key, Number(session.file_size));
    const duplicate = await query<any>('select * from audio_stems where file_sha256 = $1 limit 1', [fileSha256]);
    if (duplicate.rows[0]) {
      await exportStorage.deleteUrl(`${storageConfig.publicBaseUrl}/${session.object_key}`);
      const updated = await query<any>(
        `update asset_upload_sessions
         set status = 'completed', file_sha256 = $2,
             metadata = metadata || $3::jsonb, completed_at = now(), updated_at = now()
         where id = $1 returning *`,
        [session.id, fileSha256, JSON.stringify({ duplicateStemId: duplicate.rows[0].id })],
      );
      res.json({ session: await mapUploadSession(updated.rows[0]), asset: mapStem(duplicate.rows[0]), duplicate: true });
      return;
    }
    const metadata = session.metadata ?? {};
    const originalName = String(session.original_filename);
    const category = allowedUploadCategories.has(String(metadata.category)) ? String(metadata.category) : 'Nature';
    const title = String(metadata.name || originalName.replace(/\.[^.]+$/, '')).trim().slice(0, 140);
    const stemId = `stem_upload_${safeAssetSlug(category)}_${safeAssetSlug(title)}_${fileSha256.slice(0, 10)}`;
    const audioUrl = `/${session.object_key}`;
    const tags = String(metadata.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
    const inserted = await query<any>(
      `insert into audio_stems (
         id, name, category, audio_url, is_premium, tags, default_volume, description,
         source_platform, source_url, source_item_id, source_creator,
         license_name, license_url, commercial_use_allowed, derivative_use_allowed,
         attribution_required, raw_redistribution_allowed, qa_status, qa_notes,
         file_sha256, imported_at
       ) values (
         $1, $2, $3, $4, false, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, 'needs_review', $18,
         $19, now()
       ) returning *`,
      [
        stemId,
        title,
        category,
        audioUrl,
        tags,
        Math.max(0, Math.min(100, Math.round(Number(metadata.defaultVolume) || 60))),
        String(metadata.description || 'Resumable admin upload awaiting rights, machine QA, and listening QA.').trim().slice(0, 500),
        String(metadata.sourcePlatform || 'Admin Upload').trim().slice(0, 120),
        String(metadata.sourceUrl || '').trim().slice(0, 500),
        String(metadata.sourceItemId || '').trim().slice(0, 120),
        String(metadata.sourceCreator || '').trim().slice(0, 160),
        String(metadata.licenseName || 'Needs rights review').trim().slice(0, 160),
        String(metadata.licenseUrl || '').trim().slice(0, 500),
        metadata.commercialUseAllowed === true,
        metadata.derivativeUseAllowed === true,
        metadata.attributionRequired !== false,
        metadata.rawRedistributionAllowed === true,
        `Resumable admin upload completed on ${new Date().toISOString()}. Must pass rights, machine QA, and listening QA before approval.`,
        fileSha256,
      ],
    );
    const updated = await query<any>(
      `update asset_upload_sessions
       set status = 'completed', file_sha256 = $2, completed_at = now(), updated_at = now()
       where id = $1 returning *`,
      [session.id, fileSha256],
    );
    res.status(201).json({ session: await mapUploadSession(updated.rows[0]), asset: mapStem(inserted.rows[0]), duplicate: false });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/assets/resumable/:sessionId', async (req, res, next) => {
  try {
    const user = await requireAdminUser(req, res);
    if (!user) return;
    const session = await getOwnedUploadSession(String(req.params.sessionId), user.id);
    if (!session) {
      res.status(404).json({ error: 'Upload session not found.' });
      return;
    }
    if (session.status === 'uploading') await exportStorage.abortMultipartUpload(session.object_key, session.upload_id);
    await query(`update asset_upload_sessions set status = 'aborted', updated_at = now() where id = $1`, [session.id]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/assets/inspect-upload', async (req, res, next) => {
  let tempDir = '';
  try {
    const contentType = String(req.headers['content-type'] ?? '');
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      res.status(415).json({ error: 'Use multipart/form-data with an audio file.' });
      return;
    }
    const body = await collectRawRequestBody(req);
    const { file } = parseMultipartUpload(contentType, body);
    if (!file || file.fieldName !== 'file' || file.data.length === 0) {
      res.status(400).json({ error: 'Audio file is required.' });
      return;
    }
    const originalName = path.basename(file.filename);
    const ext = path.extname(originalName).toLowerCase();
    if (!allowedAudioUploadExtensions.has(ext)) {
      res.status(400).json({ error: 'Unsupported audio type. Upload MP3, WAV, M4A, AAC, OGG, or FLAC.' });
      return;
    }
    const sha256 = createHash('sha256').update(file.data).digest('hex');
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'snooze-upload-inspect-'));
    const tempPath = path.join(tempDir, `${safeAssetSlug(originalName)}${ext}`);
    await writeFile(tempPath, file.data);
    const inspection = await inspectUploadedAudio(tempPath);
    res.json({
      suggestion: inferUploadMetadata(originalName, file.contentType, inspection.tags, sha256, inspection.durationSeconds, inspection.sampleRate),
    });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

app.post('/api/admin/assets/upload', async (req, res, next) => {
  try {
    const contentType = String(req.headers['content-type'] ?? '');
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      res.status(415).json({ error: 'Use multipart/form-data with an audio file.' });
      return;
    }
    const body = await collectRawRequestBody(req);
    const { fields, file } = parseMultipartUpload(contentType, body);
    if (!file || file.fieldName !== 'file' || file.data.length === 0) {
      res.status(400).json({ error: 'Audio file is required.' });
      return;
    }
    const originalName = path.basename(file.filename);
    const ext = path.extname(originalName).toLowerCase();
    if (!allowedAudioUploadExtensions.has(ext)) {
      res.status(400).json({ error: 'Unsupported audio type. Upload MP3, WAV, M4A, AAC, OGG, or FLAC.' });
      return;
    }
    const category = allowedUploadCategories.has(fields.category) ? fields.category : 'Nature';
    const title = String(fields.name || originalName.replace(/\.[^.]+$/, '')).trim().slice(0, 140);
    const sourcePlatform = String(fields.sourcePlatform || 'Admin Upload').trim().slice(0, 120);
    const sourceUrl = String(fields.sourceUrl || '').trim().slice(0, 500);
    const sourceCreator = String(fields.sourceCreator || '').trim().slice(0, 160);
    const licenseName = String(fields.licenseName || 'Needs rights review').trim().slice(0, 160);
    const licenseUrl = String(fields.licenseUrl || '').trim().slice(0, 500);
    const tags = String(fields.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12);
    const commercialUseAllowed = fields.commercialUseAllowed === 'true';
    const derivativeUseAllowed = fields.derivativeUseAllowed === 'true';
    const attributionRequired = fields.attributionRequired !== 'false';
    const rawRedistributionAllowed = fields.rawRedistributionAllowed === 'true';
    const sha256 = createHash('sha256').update(file.data).digest('hex');
    const dateKey = new Date().toISOString().slice(0, 10);
    const idBase = `stem_upload_${safeAssetSlug(category)}_${safeAssetSlug(title)}`;
    const id = `${idBase}_${sha256.slice(0, 10)}`;
    const outputDir = path.join(PUBLIC_DIR, 'audio', 'uploads', 'admin', dateKey);
    await mkdir(outputDir, { recursive: true });
    const filename = `${safeAssetSlug(title)}-${sha256.slice(0, 10)}${ext}`;
    const outputPath = path.join(outputDir, filename);
    await writeFile(outputPath, file.data);
    const audioUrl = `/audio/uploads/admin/${dateKey}/${filename}`;
    const result = await query<any>(
      `insert into audio_stems (
         id, name, category, audio_url, is_premium, tags, default_volume, description,
         source_platform, source_url, source_item_id, source_creator,
         license_name, license_url, commercial_use_allowed, derivative_use_allowed,
         attribution_required, raw_redistribution_allowed, qa_status, qa_notes,
         file_sha256, imported_at
       ) values (
         $1, $2, $3, $4, false, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, 'needs_review', $18,
         $19, now()
       )
       on conflict (id) do update set
         name = excluded.name,
         category = excluded.category,
         audio_url = excluded.audio_url,
         tags = excluded.tags,
         default_volume = excluded.default_volume,
         description = excluded.description,
         source_platform = excluded.source_platform,
         source_url = excluded.source_url,
         source_creator = excluded.source_creator,
         license_name = excluded.license_name,
         license_url = excluded.license_url,
         commercial_use_allowed = excluded.commercial_use_allowed,
         derivative_use_allowed = excluded.derivative_use_allowed,
         attribution_required = excluded.attribution_required,
         raw_redistribution_allowed = excluded.raw_redistribution_allowed,
         qa_status = 'needs_review',
         qa_notes = excluded.qa_notes,
         imported_at = now()
       returning *`,
      [
        id,
        title,
        category,
        audioUrl,
        tags,
        Math.max(0, Math.min(100, Math.round(Number(fields.defaultVolume) || 60))),
        String(fields.description || 'Admin-uploaded candidate awaiting rights, machine QA, and listening QA.').trim().slice(0, 500),
        sourcePlatform,
        sourceUrl,
        String(fields.sourceItemId || '').trim().slice(0, 120),
        sourceCreator,
        licenseName,
        licenseUrl,
        commercialUseAllowed,
        derivativeUseAllowed,
        attributionRequired,
        rawRedistributionAllowed,
        `Admin upload on ${new Date().toISOString()}. Defaulted to needs_review; must pass rights, machine QA, and listening QA before approval.`,
        sha256,
      ],
    );
    res.status(201).json({ asset: mapStem(result.rows[0]), audioUrl, localPath: outputPath });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.patch('/api/admin/assets/:id/review', async (req, res, next) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const qaStatus = String(req.body?.qaStatus ?? '').trim();
    const notes = String(req.body?.notes ?? '').trim().slice(0, 1000);
    if (!id) {
      res.status(400).json({ error: 'Asset id is required.' });
      return;
    }
    if (!['approved', 'needs_review', 'rejected'].includes(qaStatus)) {
      res.status(400).json({ error: 'qaStatus must be approved, needs_review, or rejected.' });
      return;
    }

    const current = await query<any>('select * from audio_stems where id = $1', [id]);
    const stem = current.rows[0];
    if (!stem) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }

    const blockers: string[] = [];
    if (qaStatus === 'approved') {
      if (!stem.file_sha256) blockers.push('缺少文件 hash，不能进入公开播放或离线使用。');
      if (!stem.commercial_use_allowed) blockers.push('授权未确认可商用。');
      if (!stem.derivative_use_allowed) blockers.push('授权未确认可二创/混音。');
      if (stem.category === 'Voice' && !productCapabilities.guidedVoice) blockers.push('当前 Voice-free Beta 禁止批准人声素材进入发布池。');
      if (blockers.length > 0) {
        res.status(422).json({ error: 'Asset cannot be approved yet.', reasons: blockers });
        return;
      }
    }

    const reviewLine = `${new Date().toISOString()} admin review -> ${qaStatus}${notes ? `: ${notes}` : ''}`;
    const updated = await query<any>(
      `update audio_stems
       set qa_status = $2,
           qa_notes = trim(both E'\n' from concat_ws(E'\n', nullif(qa_notes, ''), $3))
       where id = $1
       returning *`,
      [id, qaStatus, reviewLine],
    );
    const asset = mapStem(updated.rows[0]);
    res.json({
      asset,
      releaseEligible: asset.qaStatus === 'approved' && asset.commercialUseAllowed && asset.derivativeUseAllowed && Boolean(asset.fileSha256) && asset.category !== 'Voice',
      warnings: qaStatus === 'approved' ? [] : ['素材不会进入公开生成、离线或导出池。'],
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/generation-decision', async (req, res, next) => {
  try {
    const prompt = String(req.body.prompt ?? '').trim();
    if (!prompt) { res.status(400).json({ error: 'Prompt is required.' }); return; }
    const intent = parseAudioIntentV2({
      prompt,
      goal: ['sleep', 'calm', 'focus'].includes(req.body.goal) ? req.body.goal : undefined,
      scene: scenes.some((item) => item.id === req.body.scene) ? req.body.scene : undefined,
    });
    const decision = await decideGeneration({
      prompt, goal: intent.goal, scene: intent.scene, contentMode: intent.contentMode,
      requiredConceptIds: Array.isArray(req.body.requiredConceptIds) ? req.body.requiredConceptIds.map(String) : [],
      excludedConceptIds: intent.excludedSounds.map((item) => `source.${item}`),
    });
    res.json({ decision });
  } catch (error) { next(error); }
});

app.post('/api/supply-gap-jobs/ensure', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const prompt = String(req.body.prompt ?? '').trim();
    if (!prompt) { res.status(400).json({ error: 'Prompt is required.' }); return; }
    const intent = parseAudioIntentV2({
      prompt,
      goal: ['sleep', 'calm', 'focus'].includes(req.body.goal) ? req.body.goal : undefined,
      scene: scenes.some((item) => item.id === req.body.scene) ? req.body.scene : undefined,
    });
    const decision = await decideGeneration({
      prompt,
      goal: intent.goal,
      scene: intent.scene,
      contentMode: intent.contentMode,
      requiredConceptIds: Array.isArray(req.body.requiredConceptIds) ? req.body.requiredConceptIds.map(String) : [],
      excludedConceptIds: intent.excludedSounds.map((item) => `source.${item}`),
    });
    const result = await ensureSupplyGapJob({ userId: user.id, prompt, decision });
    res.status(result.status === 'not_needed' ? 200 : result.status === 'cached' ? 200 : 201).json(result);
  } catch (error) { next(error); }
});

app.get('/api/supply-gap-jobs/:id', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const job = await getSupplyGapJob(req.params.id, user.id);
    if (!job) { res.status(404).json({ error: 'Supply gap job not found.' }); return; }
    const candidates = await getSupplyGapCandidates(job.id, user.id);
    res.json({ job, candidates });
  } catch (error) { next(error); }
});

app.post('/api/supply-gap-jobs/:id/process', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const result = await processSupplyGapJob({ userId: user.id, jobId: req.params.id });
    res.status(result.job.status === 'candidate_ready' ? 201 : 200).json(result);
  } catch (error) { next(error); }
});

app.get('/api/listening-qa/session', async (_req, res, next) => {
  try {
    const items = await Promise.all(defaultRecipes.map(async (recipe) => {
      const mixId = `mix_catalog_${recipe.id.replace(/-/g, '_')}`;
      const mixResult = await query<any>(
        `select id, title, rendered_audio_url, render_status
         from mixes
         where id = $1`,
        [mixId],
      );
      const qaResult = await query<any>(
        `select rendered_audio_url, duration_seconds, peak_db, integrated_lufs,
                abnormal_silence_count, passed, created_at
         from render_qa_reports
         where mix_id = $1
         order by created_at desc
         limit 1`,
        [mixId],
      );
      const mix = mixResult.rows[0];
      let qa = qaResult.rows[0];
      if (!qa && mix?.rendered_audio_url) {
        const localRenderPath = exportStorage.localPathForUrl(mix.rendered_audio_url);
        if (!localRenderPath) {
          res.status(409).json({ error: 'No stored QA report exists for this object-storage render.' });
          return;
        }
        const analyzed = await analyzeRenderedAudio(localRenderPath);
        const inserted = await query<any>(
          `insert into render_qa_reports (
             id, mix_id, recipe_version_id, rendered_audio_url, duration_seconds,
             peak_db, mean_db, integrated_lufs, true_peak_db, abnormal_silence_count, passed, details
           ) values ($1, $2, null, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
           returning rendered_audio_url, duration_seconds, peak_db, integrated_lufs,
                     abnormal_silence_count, passed, created_at`,
          [
            uid('qar'),
            mixId,
            mix.rendered_audio_url,
            analyzed.durationSeconds,
            analyzed.peakDb,
            analyzed.meanDb,
            analyzed.integratedLufs,
            analyzed.truePeakDb,
            analyzed.abnormalSilenceCount,
            analyzed.passed,
            JSON.stringify({ analyzer: 'ffmpeg', source: 'listening_qa_session_backfill' }),
          ],
        );
        qa = inserted.rows[0];
      }
      return {
        recipeId: recipe.id,
        name: recipe.name,
        goal: recipe.goal,
        scene: recipe.scene,
        durationSeconds: recipe.durationSeconds,
        mixId,
        renderedAudioUrl: mix?.rendered_audio_url ?? '',
        renderStatus: mix?.render_status ?? 'missing',
        autoQa: qa ? {
          renderedAudioUrl: qa.rendered_audio_url,
          durationSeconds: Number(qa.duration_seconds),
          peakDb: qa.peak_db === null ? null : Number(qa.peak_db),
          integratedLufs: qa.integrated_lufs === null ? null : Number(qa.integrated_lufs),
          abnormalSilenceCount: Number(qa.abnormal_silence_count),
          passed: Boolean(qa.passed),
          createdAt: qa.created_at,
        } : null,
      };
    }));
    res.json({
      generatedAt: new Date().toISOString(),
      checklistUrl: '/docs/listening-qa-checklist.md',
      items,
      scoringFields: ['sceneFit', 'balance', 'loopSmoothness', 'transientSafety', 'fatigueRisk'],
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/music-generation/lyria', async (req, res, next) => {
  let temporaryDirectory = '';
  try {
    if (!(await requireAuthenticatedUser(req, res))) return;
    const prompt = String(req.body.prompt ?? '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }
    const generation = await observeOperation('generation', () => generateLyriaMusic({
      prompt,
      model: String(req.body.model ?? '').trim() || undefined,
      projectId: String(req.body.projectId ?? '').trim() || undefined,
      location: String(req.body.location ?? '').trim() || undefined,
      endpoint: String(req.body.endpoint ?? '').trim() || undefined,
    }));
    temporaryDirectory = generation.temporaryDirectory;
    const outputKey = `${generation.projectId}/lyria/${path.basename(generation.outputPath)}`;
    const stored = await exportStorage.putFile(outputKey, generation.outputPath, generation.mimeType);
    res.status(201).json({
      provider: generation.provider,
      product: generation.product,
      projectId: generation.projectId,
      location: generation.location,
      model: generation.model,
      endpoint: generation.endpoint,
      mimeType: generation.mimeType,
      audioUrl: stored.url,
      bytes: stored.bytes,
      prompt: generation.prompt,
    });
  } catch (error) {
    next(error);
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
});

app.post('/api/listening-qa/results', async (req, res, next) => {
  try {
    const markdown = String(req.body.markdown ?? '').trim();
    const status = req.body.status === 'final' ? 'final' : 'draft';
    if (!markdown || markdown.length > 200_000) {
      res.status(400).json({ error: 'Listening QA markdown must contain 1-200000 characters.' });
      return;
    }
    await mkdir(REPORTS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `listening-qa-results-${status}-${timestamp}.md`;
    const outputPath = path.join(REPORTS_DIR, filename);
    await writeFile(outputPath, `${markdown}\n`, 'utf8');
    res.status(201).json({
      saved: true,
      status,
      filename,
      path: outputPath,
      relativePath: `reports/${filename}`,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/quick-create', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const internalMobilePlaybackQa = !runtimeConfig.production
      && req.header('x-snooze-internal-qa') === 'mobile-playback';
    const entitlement = await getBillingEntitlement(user.id, user.subscription_tier);
    if (!internalMobilePlaybackQa && entitlement.generation.remaining !== null && entitlement.generation.remaining <= 0) {
      res.status(402).json(entitlementError(
        'generation_limit_reached',
        entitlement,
        'You have used your 3 free creations. Upgrade to Plus to keep creating soundscapes.',
      ));
      return;
    }
    const prompt = String(req.body.prompt ?? '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'Please describe the soundscape you want before creating it.' });
      return;
    }
    const requestedGoalValue = String(req.body.goal ?? '').trim() as ProductGoal;
    const requestedGoal = goals.some((item) => item.id === requestedGoalValue) ? requestedGoalValue : 'sleep';
    const requestedScene = String(req.body.scene ?? '').trim() as ProductScene;
    const sceneBelongsToGoal = scenes.some((item) => item.id === requestedScene && item.goal === requestedGoal);
    const scene = sceneBelongsToGoal ? requestedScene : selectDefaultScene(requestedGoal, prompt);
    const catalogScene = scenes.find((item) => item.id === scene);
    const requestedDurationSeconds = Number(req.body.durationSeconds ?? catalogScene?.defaultDurationSeconds ?? 900);
    if (!internalMobilePlaybackQa && entitlement.playback.maxSessionSeconds !== null && requestedDurationSeconds > entitlement.playback.maxSessionSeconds) {
      res.status(402).json(entitlementError(
        'session_length_requires_plus',
        entitlement,
        `Free sessions are limited to ${FREE_MAX_SESSION_SECONDS / 60} minutes. Upgrade to Plus for longer listening.`,
      ));
      return;
    }
    const durationSeconds = Math.max(300, Math.min(7200, requestedDurationSeconds));
    const guidedVoiceRequested = Boolean(req.body.guidedVoice);
    const guidedVoice = productCapabilities.guidedVoice && guidedVoiceRequested;
    const languagePreference = normalizeLanguagePreference(req.body.languagePreference);
    const resolvedLanguage = normalizeResolvedLanguage(req.body.resolvedLanguage);
    const soundProfile = mapSoundProfile(await ensureSoundProfile(user.id));
    const planning = await observeOperation('generation', () => planQuickCreateSoundscape({
      prompt,
      requestedGoal,
      requestedScene: scene,
      guidedVoice,
      voiceEnabled: productCapabilities.guidedVoice,
      durationSeconds,
      environmentIntensity: req.body.environmentIntensity,
      musicIntensity: req.body.musicIntensity,
      voiceIntensity: req.body.voiceIntensity,
      stableExcludedSounds: soundProfile.excludedSounds,
      stableLikedSounds: soundProfile.likedSounds,
      allowDeferredCatalogSelection: runtimeConfig.production,
    }));
    // A negative constraint such as "no voice" must not disable the music
    // composition path. Only an explicit positive voice request is downgraded
    // in the Voice-free Beta.
    const positiveVoiceRequest = guidedVoiceRequested || (
      /(?:voice|spoken|narration|guide|guided|真人|人声|语音|旁白|引导)/i.test(prompt)
      && !/(?:voice[\s-]?free|无人声|无声|纯器乐|(?:no|without|exclude|remove|不要|不想要|没有|去掉|不能有|不能包含|不能出现)[^,.，。]{0,20}(?:voice|spoken|narration|guide|guided|真人|人声|语音|旁白|引导))/i.test(prompt)
    );
    const voiceDowngradedForBeta = !productCapabilities.guidedVoice
      && positiveVoiceRequest
      && planning.audioIntent.guidedVoice.enabled === false
      && planning.audioIntent.excludedSounds.includes('voice');
    const savedBaselinePreferences = await getSavedInternalBaselinePreferences(user.id);
    const baselineSelection = voiceDowngradedForBeta ? null : selectInternalBaselineRecipe({
      prompt,
      audioIntent: planning.audioIntent,
      durationSeconds,
      savedBaselinePreferences,
    });
    if (planning.catalogSelectionDeferred && !baselineSelection) {
      throw new SupplyGapError(planning.requestId, ['approved_asset_combination']);
    }
    const foundationalExcludedSounds = reconcileFoundationalExcludedSounds(prompt, planning.audioIntent.excludedSounds);
    // Foundational composer material is internal review content. Production
    // must route only to finished, owner-approved baseline soundscapes.
    const foundationalSelectionCandidate = runtimeConfig.production || voiceDowngradedForBeta || baselineSelection ? null : selectFoundationalElementRecipe({
      prompt,
      goal: planning.audioIntent.goal,
      scene: planning.audioIntent.scene,
      contentMode: planning.audioIntent.contentMode,
      excludedSounds: foundationalExcludedSounds,
      environmentPreferences: planning.audioIntent.environmentPreferences,
      selectionKey: String(res.locals.requestId ?? ''),
      durationSeconds,
    });
    // An explicit environment request is a hard user contract. The
    // foundational element composer currently returns music-only layers, so
    // let the approved scene baseline satisfy rain, noise, water, and nature
    // preferences instead of silently replacing them with tonal elements.
    const foundationalSelection = planning.audioIntent.environmentPreferences.length > 0
      ? null
      : foundationalSelectionCandidate;
    const musicKitRecipe = runtimeConfig.production || voiceDowngradedForBeta || baselineSelection || foundationalSelection || !explicitlyRequestsMusicKit(prompt, planning.audioIntent) ? null : selectMusicKitCatalogRecipe({
      prompt,
      goal: planning.audioIntent.goal,
      scene: planning.audioIntent.scene,
      contentMode: planning.audioIntent.contentMode,
      excludedSounds: planning.audioIntent.excludedSounds,
      selectionKey: String(res.locals.requestId ?? ''),
    });
    const composerBundlePlan = foundationalSelection ? buildFoundationalCompositionBundle({
      prompt,
      goal: planning.audioIntent.goal,
      scene: planning.audioIntent.scene,
      excludedSounds: foundationalExcludedSounds,
      preferredSounds: planning.audioIntent.environmentPreferences,
      selectionKey: String(res.locals.requestId ?? ''),
    }) : null;
    const composerRenderPilot = runtimeConfig.production || voiceDowngradedForBeta || baselineSelection ? null : selectComposerResultRenderPilot({
      prompt,
      goal: planning.audioIntent.goal,
      scene: planning.audioIntent.scene,
      durationSeconds,
      composerBundlePlan,
    });
    const recipe = voiceDowngradedForBeta
      ? { ...planning.recipe, contentMode: 'pure_soundscape' as const }
      : composerRenderPilot?.recipe ?? foundationalSelection?.recipe ?? musicKitRecipe ?? baselineSelection?.recipe ?? planning.recipe;
    const audioIntent: PlannedAudioIntent = composerRenderPilot || foundationalSelection || musicKitRecipe || baselineSelection
      ? {
          ...planning.audioIntent,
          contentMode: recipe.contentMode,
          excludedSounds: composerRenderPilot || foundationalSelection ? foundationalExcludedSounds : planning.audioIntent.excludedSounds,
          excludedConceptIds: composerRenderPilot || foundationalSelection
            ? foundationalExcludedSounds.map((item) => `source.${item}`)
            : planning.audioIntent.excludedConceptIds,
          planner: {
            ...planning.audioIntent.planner,
            explanation: composerRenderPilot
              ? `${planning.audioIntent.planner.explanation} Selected professionally rendered composer proof ${composerRenderPilot.proofId} for immediate playable output; no owner material choice or runtime external generation.`
              : foundationalSelection
              ? `${planning.audioIntent.planner.explanation} Built ${foundationalSelection.plan.id} from three approved reusable elements without a runtime music API call.`
              : musicKitRecipe
                ? `${planning.audioIntent.planner.explanation} Selected an approved synchronized MusicKit for the explicit music request.`
                : `${planning.audioIntent.planner.explanation} Selected owner-approved internal content baseline seed ${baselineSelection!.seed.id} to avoid weak noise-led default output.`,
          },
        }
      : voiceDowngradedForBeta
        ? {
            ...planning.audioIntent,
            contentMode: 'pure_soundscape',
            planner: {
              ...planning.audioIntent.planner,
              explanation: `${planning.audioIntent.planner.explanation} Voice was requested, but Voice-free Beta downgrades it to a non-voice pure soundscape.`,
            },
          }
        : planning.audioIntent;
    await assertRecipeMatchesIntent(recipe, audioIntent);
    const generationDecision = await decideGeneration({
      prompt,
      goal: audioIntent.goal,
      scene: audioIntent.scene,
      contentMode: audioIntent.contentMode,
      requiredConceptIds: audioIntent.requiredConceptIds,
      excludedConceptIds: audioIntent.excludedConceptIds,
    });

    const createDraftInput = {
      userId: user.id,
      recipe,
      durationSeconds,
      prompt,
      guidedVoice,
      languagePreference,
      resolvedLanguage,
      soundProfile,
      audioIntent,
      generationDecision,
    };
    const result = composerRenderPilot
      ? await createDraftFromComposerResultRenderPilot({
          ...createDraftInput,
          proofAudioUrl: composerRenderPilot.proofAudioUrl,
          proofId: composerRenderPilot.proofId,
          composerMode: composerRenderPilot.composerMode,
        })
      : await createDraftFromCatalogRecipe(createDraftInput);
    res.status(201).json({
      ...result,
      audioIntent,
      generationDecision,
      planning: {
        requestId: planning.requestId,
        provider: audioIntent.planner.provider,
        model: audioIntent.planner.model,
        selected: foundationalSelection
          ? composerRenderPilot?.planningSelected ?? foundationalSelection.plan.selected.map((element) => ({ stemId: element.stemId, role: 'music', reason: element.reason }))
          : musicKitRecipe
            ? musicKitRecipe.tracks.map((track) => ({ stemId: track.stemId, role: track.role, reason: `Approved MusicKit ${track.musicKitId}.` }))
          : baselineSelection
          ? [{ stemId: baselineSelection.seed.stemId, role: 'music', reason: 'Owner-approved internal audible product baseline seed.' }]
          : planning.selected,
        rejectedCount: planning.rejected.length,
        internalBaselineSeed: foundationalSelection || musicKitRecipe ? null : baselineSelection?.seed.id ?? null,
        elementCompositionPlan: foundationalSelection?.plan ?? null,
        composerBundlePlan,
        composerRenderPilot: composerRenderPilot ? {
          source: composerRenderPilot.source,
          proofId: composerRenderPilot.proofId,
          proofAudioUrl: composerRenderPilot.proofAudioUrl,
          composerMode: composerRenderPilot.composerMode,
          professionalVerdict: composerRenderPilot.professionalVerdict,
          selectedAtomicElementIds: composerRenderPilot.selectedAtomicElementIds,
          selectedSupportMaterialIds: composerRenderPilot.selectedSupportMaterialIds,
          productionAllowed: false,
          publicReleaseAllowed: false,
        } : null,
        musicKitId: musicKitRecipe?.tracks[0]?.musicKitId ?? null,
        savedBaselinePreferenceApplied: Boolean(baselineSelection && savedBaselinePreferences.some((preference) => preference.seedId === baselineSelection.seed.id)),
      },
    });
  } catch (error) {
    if (error instanceof SupplyGapError) {
      res.status(error.statusCode).json({
        error: 'The approved asset library does not yet contain the requested sound.',
        requestId: error.requestId,
        unmetRequirements: error.unmetRequirements,
      });
      return;
    }
    next(error);
  }
});

app.get('/api/listen/home', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const mixesResult = await query<any>(`select * from mixes where ${PUBLISHED_READY_WHERE} order by plays_count desc`);
    const mixes = mixesResult.rows.map(mapMix);
    const historyResult = await query<any>(
      `select recent.* from (
         select distinct on (m.id) m.*, h.played_at as latest_played_at
         from user_history h join mixes m on m.id = h.mix_id
         where h.user_id = $1 and ${MIX_PUBLISHED_READY_WHERE}
         order by m.id, h.played_at desc
       ) recent
       order by recent.latest_played_at desc limit 8`,
      [user.id],
    );
    const history = historyResult.rows.map(mapMix);

    res.json({
      daily: mixes[0],
      recentlyPlayed: history.length > 0 ? history : mixes.slice(1, 4),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/discover-config', async (_req, res, next) => {
  try {
    const [config, availableMixes] = await Promise.all([
      loadDiscoverConfig(),
      query<any>(
        `select m.*,
                coalesce((
                  select array_agg(distinct s.category order by s.category)
                  from jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) as track
                  join audio_stems s on s.id = track->>'stemId'
                  where coalesce(track->>'isMuted', 'false') <> 'true'
                    and coalesce((track->>'volume')::numeric, 0) > 0
                ), '{}'::text[]) as track_categories
         from mixes m
         where ${MIX_DISCOVER_ELIGIBLE_WHERE}
         order by plays_count desc, updated_at desc
         limit 120`,
      ),
    ]);
    const releaseEligibleMixIds = availableMixes.rows.map((mix) => mix.id);
    const demandPools = buildDiscoverDemandPools(config, availableMixes.rows);
    res.json({
      ...config,
      availableMixes: availableMixes.rows.map(mapMix),
      demandPools,
      governance: buildDiscoverGovernance(config, releaseEligibleMixIds),
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/discover-config', async (req, res, next) => {
  try {
    const config = normalizeDiscoverConfig(req.body);
    const availableMixes = await query<any>(
      `select m.id from mixes m
       where ${MIX_DISCOVER_ELIGIBLE_WHERE}
       order by plays_count desc, updated_at desc
       limit 500`,
    );
    const governance = buildDiscoverGovernance(config, availableMixes.rows.map((row) => row.id));
    if (governance.blockedBindings.length > 0) {
      res.status(422).json({
        error: 'Discover configuration can only reference published, rendered, release-eligible content.',
        blockedBindings: governance.blockedBindings,
        reasons: governance.blockedBindings.map((item) => `${item.sectionId} -> ${item.mixId}: ${item.reason}`),
      });
      return;
    }
    await mkdir(path.dirname(DISCOVER_CONFIG_PATH), { recursive: true });
    await writeFile(DISCOVER_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    await syncDiscoverPlacements(config);
    res.json({ ...config, governance });
  } catch (error) {
    next(error);
  }
});

app.get('/api/discover', async (req, res, next) => {
  try {
    const config = await loadDiscoverConfig();
    const queryText = String(req.query.query ?? '').trim().toLowerCase().replace(/^#+/, '');
    const result = await query<any>(
      queryText
        ? `select m.* from mixes m
           where ${MIX_DISCOVER_ELIGIBLE_WHERE}
           and (
             lower(m.title) like $1
             or lower(m.description) like $1
             or exists (
               select 1
               from jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) as recipe_track
               join audio_stems on audio_stems.id = recipe_track->>'stemId'
               where coalesce(recipe_track->>'isMuted', 'false') <> 'true'
                 and coalesce((recipe_track->>'volume')::numeric, 0) > 0
                 and (
                   lower(audio_stems.name) like $1
                   or exists (select 1 from unnest(audio_stems.tags) as stem_tag where lower(stem_tag) like $1)
                 )
             )
           )
           order by plays_count desc, updated_at desc
           limit 50`
        : `select m.* from mixes m where ${MIX_DISCOVER_ELIGIBLE_WHERE} order by plays_count desc, updated_at desc`,
      queryText ? [`%${queryText}%`] : [],
    );
    const mixes = result.rows.map(mapMix);
    res.json({
      editorsChoice: queryText ? null : mixes[0] ?? null,
      trending: mixes,
      tags: config.tags,
      heroLabel: config.heroLabel,
      quickActions: config.quickActions,
      sections: queryText ? [] : buildDiscoverSections(config, mixes),
      creators: await getAllUsers(),
      search: { query: queryText, total: mixes.length, exactContentMatches: Boolean(queryText) },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/studio', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const queryText = String(req.query.query ?? '').trim().toLowerCase();
    const requestedGoal = String(req.query.goal ?? '').trim().toLowerCase();
    const goal = ['sleep', 'calm', 'focus'].includes(requestedGoal) ? requestedGoal : '';
    const includeAll = String(req.query.all ?? '') === 'true';
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.max(1, Math.min(50, Number.parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const params: unknown[] = [user.id];
    const filters = ['creator_id = $1'];
    if (queryText) {
      params.push(`%${queryText}%`);
      filters.push(`(lower(title) like $${params.length} or lower(description) like $${params.length} or lower(coalesce(recipe_data #>> '{audioIntent,rawPrompt}', '')) like $${params.length})`);
    }
    if (goal) {
      params.push(goal);
      filters.push(`coalesce(recipe_data #>> '{audioIntent,goal}', recipe_data #>> '{goal}') = $${params.length}`);
    }
    const where = filters.join(' and ');
    const totalsResult = await query<any>(
      `select count(*)::int as total,
         coalesce(sum(plays_count), 0)::int as total_plays,
         coalesce(sum(completion_50_count), 0)::int as total_completions
       from mixes where ${where}`,
      params,
    );
    const result = includeAll
      ? await query<any>(`select * from mixes where ${where} order by updated_at desc`, params)
      : await query<any>(
        `select * from mixes where ${where} order by updated_at desc limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      );
    const mixes = result.rows.map(mapMix);
    const total = Number(totalsResult.rows[0]?.total ?? 0);
    const totalPlays = Number(totalsResult.rows[0]?.total_plays ?? 0);
    const totalCompletions = Number(totalsResult.rows[0]?.total_completions ?? 0);
    res.json({
      mixes,
      totalPlays,
      engagementRate: totalPlays > 0 ? Math.round((totalCompletions / totalPlays) * 100) : 0,
      pagination: {
        page: includeAll ? 1 : page,
        pageSize: includeAll ? total : pageSize,
        total,
        hasMore: !includeAll && page * pageSize < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public/mixes/:id', async (req, res, next) => {
  try {
    const mix = await getMixById(req.params.id);
    if (!mix || mix.status !== 'published' || !mix.publishedVersionId) {
      res.status(404).json({ error: 'Public work not found.' });
      return;
    }
    const users = await getAllUsers();
    const stems = await getAllStems();
    const trackStems = await getStemsForMixTracks(mix);
    res.json({
      mix,
      creatorName: users.find((user: any) => user.id === mix.creatorId)?.username ?? 'MixStil',
      stems,
      tracks: mixToTracks(mix, trackStems),
      playbackPolicy: await getPlaybackPolicy(req, mix),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id', async (req, res, next) => {
  try {
    const mix = await getMixById(req.params.id);
    if (!mix) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    const user = await getAuthenticatedUser(req);
    if ((mix.status !== 'published' || !mix.publishedVersionId) && mix.creatorId !== user?.id) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    const users = await getAllUsers();
    const stems = await getAllStems();
    const trackStems = await getStemsForMixTracks(mix);
    res.json({
      mix,
      creatorName: users.find((user: any) => user.id === mix.creatorId)?.username ?? 'MixStil',
      stems,
      tracks: mixToTracks(mix, trackStems),
      playbackPolicy: await getPlaybackPolicy(req, mix),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/versions', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const result = await query<any>(
      `select id, version_number, recipe_data, created_at
       from mix_recipe_versions where mix_id = $1 order by version_number desc`,
      [req.params.id],
    );
    res.json(result.rows.map((row) => ({
      id: row.id,
      versionNumber: row.version_number,
      recipeData: row.recipe_data,
      createdAt: row.created_at,
      isCurrent: row.id === mix.publishedVersionId,
    })));
  } catch (error) {
    next(error);
  }
});

const SHARE_EVENT_TYPES = new Set([
  'share_page_opened',
  'playback_requested',
  'playback_started',
  'meaningful_listen',
  'favorite_added',
  'create_from_share_started',
  'gift_response_sent',
  'reshared',
]);

const SHARE_COPY_BLOCKED = /\b(cure|treat|treatment|clinically proven|insomnia cure|anxiety cure|heal anxiety|guaranteed sleep)\b|治疗失眠|治愈焦虑|保证入睡|修复创伤|替代药物|治疗\s*PTSD/i;

app.get('/api/mixes/:id/share-links', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const result = await query<any>(
      `select * from share_links
       where mix_id = $1 and revoked_at is null and (expires_at is null or expires_at > now())
       order by created_at desc`,
      [mix.id],
    );
    res.json({ shareLinks: result.rows.map(mapShareLink) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/share-links', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { user, mix } = owned;
    if ((mix.status !== 'published' && mix.status !== 'private') || !mix.publishedVersionId) {
      res.status(409).json({ error: 'Publish and freeze this work before creating a share link.' });
      return;
    }

    const exportCheck = await getExportCheck(mix);
    if (!exportCheck.exportReady) {
      res.status(409).json({ error: 'This work contains audio that is not approved for public sharing.', exportCheck });
      return;
    }

    const intent = String(req.body.intent ?? '');
    if (intent !== 'tonight' && intent !== 'gift') {
      res.status(400).json({ error: 'Share intent must be tonight or gift.' });
      return;
    }
    const visibility = intent === 'gift' ? 'unlisted' : (req.body.visibility === 'unlisted' ? 'unlisted' : 'public');
    if (mix.status === 'private' && visibility === 'public') {
      res.status(409).json({ error: 'A private work can only be shared with one registered listener at a time.' });
      return;
    }
    const title = String(req.body.title ?? mix.title).trim().slice(0, 100);
    const description = String(req.body.description ?? mix.description ?? '').trim().slice(0, 280);
    const recipientLabel = intent === 'gift' ? String(req.body.recipientLabel ?? '').trim().slice(0, 60) : '';
    const personalMessage = String(req.body.personalMessage ?? '').trim().slice(0, 280);
    if (!title) {
      res.status(400).json({ error: 'A share title is required.' });
      return;
    }
    if (SHARE_COPY_BLOCKED.test(`${title} ${description} ${personalMessage}`)) {
      res.status(400).json({ error: 'Medical claims are not allowed in shared titles, descriptions, or messages.' });
      return;
    }

    const creatorName = String(req.body.creatorName ?? user.username ?? 'MixStil').trim().slice(0, 60) || 'MixStil';
    const trackStems = await getStemsForMixTracks(mix);
    const stemById = new Map(trackStems.map((stem: any) => [stem.id, stem]));
    const soundElements = Array.from(new Set<string>((mix.recipeData.tracks ?? [])
      .filter((track: any) => !track.isMuted && Number(track.volume ?? 0) > 0)
      .map((track: any) => stemById.get(track.stemId)?.name)
      .filter(Boolean)))
      .slice(0, 3);
    const expiresAtInput = req.body.expiresAt ? new Date(String(req.body.expiresAt)) : null;
    if (expiresAtInput && (!Number.isFinite(expiresAtInput.getTime()) || expiresAtInput.getTime() <= Date.now())) {
      res.status(400).json({ error: 'Share link expiry must be a future date.' });
      return;
    }

    const id = uid('share');
    const slug = uid('s').replace('s_', '');
    const result = await query<any>(
      `insert into share_links (
        id, slug, mix_id, recipe_version_id, creator_id, intent, visibility,
        title_snapshot, description_snapshot, cover_snapshot, creator_name_snapshot,
        sound_elements, recipient_label, personal_message, recipient_user_id, expires_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      returning *`,
      [
        id,
        slug,
        mix.id,
        mix.publishedVersionId,
        user.id,
        intent,
        visibility,
        title,
        description,
        mix.coverImageUrl || DEFAULT_COVER,
        creatorName,
        soundElements,
        recipientLabel,
        personalMessage,
        null,
        expiresAtInput,
      ],
    );
    await query('update mixes set share_clicks = share_clicks + 1, updated_at = now() where id = $1', [mix.id]);
    const createdShare = result.rows[0];
    res.status(201).json({
      ...mapShareLink(createdShare),
      creatorPreviewToken: createShareCreatorPreviewToken(createdShare),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/share-links/:slug', async (req, res, next) => {
  try {
    const shareResult = await query<any>('select * from share_links where slug = $1', [req.params.slug]);
    const row = shareResult.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Shared sound not found.' });
      return;
    }
    if (row.revoked_at || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())) {
      res.status(410).json({ error: 'This shared sound is no longer available.' });
      return;
    }
    if (!await enforcePrivateShareAccess(req, res, row)) return;
    const mix = await getMixById(row.mix_id);
    if (!mix) {
      res.status(404).json({ error: 'Shared sound not found.' });
      return;
    }
    const versionResult = await query<any>(
      'select recipe_data from mix_recipe_versions where id = $1 and mix_id = $2',
      [row.recipe_version_id, row.mix_id],
    );
    if (!versionResult.rows[0]) {
      res.status(409).json({ error: 'The frozen recipe for this shared sound is unavailable.' });
      return;
    }
    const frozenMix = {
      ...mix,
      title: row.title_snapshot,
      description: row.description_snapshot,
      coverImageUrl: row.cover_snapshot,
      recipeData: upgradeRecipeToV2(versionResult.rows[0].recipe_data, row.recipe_version_id),
    };
    const trackStems = await getStemsForMixTracks(frozenMix);
    const plannedShareTracks = planRecipeRenderTracks(frozenMix.recipeData)
      .filter((track: any) => productCapabilities.guidedVoice || track.role !== 'voice');
    const activeStemIds = Array.from(new Set<string>(plannedShareTracks
      .filter((track: any) => !track.isMuted && Number(track.volume ?? 0) > 0)
      .map((track: any) => String(track.stemId))));
    res.json({
      shareLink: mapShareLink(row),
      durationSeconds: frozenMix.recipeData.durationSeconds,
      tracks: mixToTracks(frozenMix, trackStems).filter((track: any) => productCapabilities.guidedVoice || track.role !== 'voice'),
      attributionCredits: buildAttributionCredits(trackStems, activeStemIds),
      playbackPolicy: await getPlaybackPolicy(req, frozenMix),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/share-links/:slug/events', async (req, res, next) => {
  try {
    const shareResult = await query<any>('select id, slug, creator_id, visibility, recipient_user_id, revoked_at, expires_at from share_links where slug = $1', [req.params.slug]);
    const share = shareResult.rows[0];
    if (!share) {
      res.status(404).json({ error: 'Shared sound not found.' });
      return;
    }
    if (!await enforcePrivateShareAccess(req, res, share)) return;
    if (share.revoked_at || (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())) {
      res.status(410).json({ error: 'This shared sound is no longer available.' });
      return;
    }
    const eventType = String(req.body.eventType ?? '');
    if (!SHARE_EVENT_TYPES.has(eventType)) {
      res.status(400).json({ error: 'Invalid share event.' });
      return;
    }
    const elapsedMs = Math.max(0, Math.min(86_400_000, Math.round(Number(req.body.elapsedMs ?? 0) || 0)));
    const playbackSeconds = Math.max(0, Math.min(86_400, Math.round(Number(req.body.playbackSeconds ?? 0) || 0)));
    const visitorId = String(req.body.visitorId ?? '').trim().slice(0, 100);
    const source = String(req.body.source ?? '').trim().slice(0, 100);
    const details = req.body.details && typeof req.body.details === 'object' ? req.body.details : {};
    await query(
      `insert into share_events (
        id, share_link_id, anonymous_visitor_id, event_type, source, elapsed_ms, playback_seconds, details
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [uid('shareevt'), share.id, visitorId, eventType, source, elapsedMs, playbackSeconds, JSON.stringify(details)],
    );
    res.status(201).json({ recorded: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/qa-reports', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const result = await query<any>(
      `select * from render_qa_reports where mix_id = $1 order by created_at desc`,
      [req.params.id],
    );
    res.json(result.rows.map((row) => ({
      id: row.id,
      recipeVersionId: row.recipe_version_id,
      renderedAudioUrl: row.rendered_audio_url,
      durationSeconds: row.duration_seconds,
      peakDb: row.peak_db,
      meanDb: row.mean_db,
      integratedLufs: row.integrated_lufs,
      truePeakDb: row.true_peak_db,
      abnormalSilenceCount: row.abnormal_silence_count,
      passed: row.passed,
      createdAt: row.created_at,
    })));
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/voice-script', async (req, res, next) => {
  if (rejectVoiceWhenDisabled(res)) return;
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const language = (req.query.language === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
    if (!mix.recipeData.intent) { res.status(400).json({ error: 'This mix does not have a supported voice scene.' }); return; }
    const blocks = selectVoiceScript(mix.recipeData.intent as ProductScene, language);
    res.json({ language, blocks, script: blocks.map((block) => block.text).join('\n\n') });
  } catch (error) { next(error); }
});

const createVoicePreviewForMix = async (input: {
  mix: any;
  language: 'en' | 'zh';
  scriptText?: string;
  voice?: string;
}) => {
  const jobId = uid('tts');
  try {
    const { mix, language } = input;
    if (!mix.recipeData.intent) throw new Error('This mix does not have a supported voice scene.');
    const approvedBlocks = selectVoiceScript(mix.recipeData.intent as ProductScene, language);
    const defaultScript = approvedBlocks.map((block) => block.text).join(' ');
    const scriptText = String(input.scriptText ?? defaultScript).trim();
    if (!scriptText || scriptText.length > 2000) throw new Error('Controlled voice script must contain 1-2000 characters.');
    await query(
      `insert into tts_jobs (id, mix_id, status, provider, language, script_text, character_count)
       values ($1, $2, 'running', $3, $4, $5, $6)`,
      [jobId, mix.id, process.env.TTS_PROVIDER ?? 'edge-tts', language, scriptText, scriptText.length],
    );
    const outputDir = path.join(PUBLIC_DIR, 'audio', 'voice', 'generated');
    const generated = await generateTts({ text: scriptText, language, voice: input.voice, outputDir, outputId: jobId });
    const audioUrl = `/audio/voice/generated/${jobId}.mp3`;
    const metadata = await probeAudioSource(generated.outputPath);
    const stemId = `stem_${jobId}`;
    await query(
      `insert into audio_stems (
         id, name, category, audio_url, tags, default_volume, description,
         source_platform, source_item_id, license_name, commercial_use_allowed,
         derivative_use_allowed, attribution_required, raw_redistribution_allowed, qa_status, qa_notes, imported_at
       ) values ($1, $2, 'Voice', $3, $4, 50, $5, $6, $7, $8, false, false, false, false, 'needs_review', $9, now())`,
      [stemId, `${language.toUpperCase()} Guided Voice Preview`, audioUrl, [language, 'Guided Voice', 'Preview'], 'Controlled TTS preview awaiting pronunciation and rights QA.', generated.provider, jobId, generated.licenseName, 'Preview only. Commercial and derivative use blocked until review.'],
    );
    const latestMix = await getMixById(mix.id);
    if (!latestMix) throw new Error('Mix was removed while voice preview was being generated.');
    const voiceStart = Math.max(5, latestMix.recipeData.phases?.[0]?.startTime ?? 5);
    const recipeData = {
      ...latestMix.recipeData,
      tracks: [...latestMix.recipeData.tracks.filter((track: any) => track.role !== 'voice'), {
        stemId, role: 'voice', volume: Math.min(36, Math.max(22, Math.round(Number((latestMix.recipeData.audioIntent as any)?.intensity?.voice ?? 50) * 0.6))), isMuted: false,
        startTime: voiceStart, duration: metadata.durationSeconds, trimStart: 0, trimEnd: metadata.durationSeconds,
        phaseIds: ['arrival', 'core'], playbackRate: 1, fade: { inSeconds: 0.4, outSeconds: 1.2 }, loop: { enabled: false, crossfadeSeconds: 0 },
      }],
      ducking: [{ triggerRole: 'voice', targetRoles: ['base', 'environment', 'music'], reductionDb: 6, attackSeconds: 0.3, releaseSeconds: 1.2 }],
      voicePlan: generated.voiceCues?.length ? {
        language,
        mode: 'guided_meditation',
        cues: generated.voiceCues.map((cue, index) => ({ ...cue, id: `${jobId}-cue-${index + 1}`, startTime: voiceStart + cue.startTime })),
        exitAtSeconds: voiceStart + metadata.durationSeconds,
      } : undefined,
      quickCreate: { ...objectRecord(latestMix.recipeData.quickCreate), guidedVoiceStatus: 'preview_ready' },
    };
    await query(`update mixes set recipe_data = $2::jsonb, render_status = 'not_rendered', updated_at = now() where id = $1`, [mix.id, JSON.stringify(recipeData)]);
    await query(
      `update tts_jobs set status='ready', model=$2, voice=$3, cost_usd=$4, license_name=$5,
       commercial_use_allowed=$6, output_audio_url=$7, updated_at=now() where id=$1`,
      [jobId, generated.model, generated.voice, generated.costUsd, generated.licenseName, generated.commercialUseAllowed, audioUrl],
    );
    return { jobId, status: 'ready' as const, audioUrl, stemId, mix: await getMixById(mix.id) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TTS generation failed';
    await query(`update tts_jobs set status='failed', error=$2, updated_at=now() where id=$1`, [jobId, message]).catch(() => undefined);
    throw error;
  }
};

app.post('/api/mixes/:id/voice-generation', async (req, res) => {
  if (rejectVoiceWhenDisabled(res)) return;
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const language = (req.body.language === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
    const result = await createVoicePreviewForMix({ mix, language, scriptText: req.body.scriptText, voice: req.body.voice });
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TTS generation failed';
    res.status(400).json({ error: message, status: 'failed', fallback: 'voice_off' });
  }
});

app.post('/api/mixes/:id/voice-preview/ensure', async (req, res) => {
  if (rejectVoiceWhenDisabled(res)) return;
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const voiceTrack = mix.recipeData.tracks.find((track: any) => track.role === 'voice' && !track.isMuted);
    if (voiceTrack) {
      const stem = (await getStemRowsByIds([voiceTrack.stemId]))[0];
      res.json({ status: 'ready', existing: true, audioUrl: stem?.audioUrl ?? '', stemId: voiceTrack.stemId, mix });
      return;
    }
    const requested = Boolean((mix.recipeData.audioIntent as any)?.guidedVoice?.enabled || (mix.recipeData.quickCreate as any)?.guidedVoiceRequested);
    if (!requested) {
      res.status(409).json({ error: 'Guided voice was not requested for this mix.', status: 'voice_off', fallback: 'voice_off' });
      return;
    }
    const active = await query<any>(
      `select id, status from tts_jobs where mix_id = $1 and status in ('queued', 'running') order by created_at desc limit 1`,
      [mix.id],
    );
    if (active.rows[0]) {
      res.status(202).json({ jobId: active.rows[0].id, status: 'running', fallback: 'voice_off', mix });
      return;
    }
    const language = ((mix.recipeData.audioIntent as any)?.guidedVoice?.language === 'zh' ? 'zh' : 'en') as 'en' | 'zh';
    const result = await createVoicePreviewForMix({ mix, language });
    res.status(201).json({ ...result, existing: false });
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(202).json({ status: 'running', fallback: 'voice_off' });
      return;
    }
    const message = error instanceof Error ? error.message : 'TTS generation failed';
    res.status(400).json({ error: message, status: 'failed', fallback: 'voice_off' });
  }
});

app.get('/api/mixes/:id/voice-preview/status', async (req, res, next) => {
  if (rejectVoiceWhenDisabled(res)) return;
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const voiceTrack = mix.recipeData.tracks.find((track: any) => track.role === 'voice' && !track.isMuted);
    if (voiceTrack) {
      const stem = (await getStemRowsByIds([voiceTrack.stemId]))[0];
      res.json({ status: 'ready', audioUrl: stem?.audioUrl ?? '', stemId: voiceTrack.stemId, mix });
      return;
    }
    const latest = await query<any>(
      `select id, status, error from tts_jobs where mix_id = $1 order by created_at desc limit 1`,
      [mix.id],
    );
    res.json({
      jobId: latest.rows[0]?.id ?? null,
      status: latest.rows[0]?.status ?? 'not_started',
      error: latest.rows[0]?.error ?? '',
      fallback: 'voice_off',
      mix,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/voice-qa/pending', async (_req, res, next) => {
  try {
    const result = await query<any>(
      `select s.*, t.id as tts_job_id, t.mix_id, t.provider, t.model, t.voice, t.language,
              t.script_text, t.cost_usd, t.commercial_use_allowed as tts_commercial_use_allowed,
              t.output_audio_url
       from audio_stems s
       left join tts_jobs t on t.id = s.source_item_id
       where s.category = 'Voice'
         and s.qa_status in ('candidate', 'needs_review')
       order by s.imported_at desc nulls last, s.name asc`,
    );
    res.json(result.rows.map((row) => ({
      stem: mapStem(row),
      ttsJob: row.tts_job_id ? {
        id: row.tts_job_id,
        mixId: row.mix_id,
        provider: row.provider,
        model: row.model,
        voice: row.voice,
        language: row.language,
        scriptText: row.script_text,
        costUsd: Number(row.cost_usd ?? 0),
        commercialUseAllowed: row.tts_commercial_use_allowed,
        outputAudioUrl: row.output_audio_url,
      } : null,
    })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/voice-qa/:stemId/review', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const stemResult = await query<any>('select * from audio_stems where id = $1', [req.params.stemId]);
    const stemRow = stemResult.rows[0];
    if (!stemRow) {
      res.status(404).json({ error: 'Voice stem not found.' });
      return;
    }
    const stem = mapStem(stemRow);
    if (stem.category !== 'Voice') {
      res.status(400).json({ error: 'Only Voice stems can enter the voice QA workflow.' });
      return;
    }

    const input = {
      decision: String(req.body.decision ?? 'needs_review') as VoiceQaDecision,
      reviewerId: user.id,
      scriptSafetyPassed: Boolean(req.body.scriptSafetyPassed),
      pronunciationPassed: Boolean(req.body.pronunciationPassed),
      rightsPassed: Boolean(req.body.rightsPassed),
      commercialUseAllowed: Boolean(req.body.commercialUseAllowed),
      derivativeUseAllowed: Boolean(req.body.derivativeUseAllowed),
      notes: String(req.body.notes ?? ''),
    };
    const errors = validateVoiceQaInput(input);
    if (errors.length > 0) {
      res.status(400).json({ error: 'Voice QA review cannot be applied.', reasons: errors });
      return;
    }

    const update = voiceQaStemUpdate(input);
    const reviewId = uid('vqar');
    await query(
      `insert into voice_qa_reviews (
         id, stem_id, tts_job_id, reviewer_id, decision, script_safety_passed,
         pronunciation_passed, rights_passed, commercial_use_allowed, derivative_use_allowed, notes
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        reviewId,
        stem.id,
        stem.sourceItemId || null,
        input.reviewerId,
        input.decision,
        Boolean(input.scriptSafetyPassed),
        Boolean(input.pronunciationPassed),
        Boolean(input.rightsPassed),
        Boolean(input.commercialUseAllowed),
        Boolean(input.derivativeUseAllowed),
        input.notes ?? '',
      ],
    );
    const updatedStem = await query<any>(
      `update audio_stems set
         qa_status = $2,
         commercial_use_allowed = $3,
         derivative_use_allowed = $4,
         raw_redistribution_allowed = false,
         qa_notes = $5,
         tags = case
           when $2 = 'approved' then array_remove(tags, 'Preview')
           else tags
         end
       where id = $1
       returning *`,
      [stem.id, update.qaStatus, update.commercialUseAllowed, update.derivativeUseAllowed, update.qaNotes],
    );
    if (stem.sourceItemId) {
      await query(
        `update tts_jobs set commercial_use_allowed = $2, updated_at = now() where id = $1`,
        [stem.sourceItemId, update.commercialUseAllowed],
      );
    }
    res.json({
      reviewId,
      stem: mapStem(updatedStem.rows[0]),
      exportEligible: update.qaStatus === 'approved' && update.commercialUseAllowed && update.derivativeUseAllowed,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const { title, description, status, recipeData, coverImageUrl } = req.body;
    const entitlement = await getBillingEntitlement(user.id, user.subscription_tier);
    if ((status === 'published' || status === 'private')
      && entitlement.savedSounds.limit !== null
      && entitlement.savedSounds.used >= entitlement.savedSounds.limit) {
      res.status(402).json(entitlementError(
        'saved_sound_limit_reached',
        entitlement,
        `Free accounts can save ${FREE_SAVED_SOUND_LIMIT} sounds. Upgrade to Plus to save more.`,
      ));
      return;
    }
    const blocked = /\b(cure|treat|treatment|clinically proven|insomnia cure|anxiety cure|heal anxiety|guaranteed sleep)\b/i;
    if (blocked.test(`${title} ${description}`)) {
      res.status(400).json({ error: 'Medical claims are not allowed in titles or descriptions.' });
      return;
    }
    if ((status === 'published' || status === 'private') && !hasAudibleRecipeContent(recipeData)) {
      res.status(400).json({ error: 'Add at least one audible track before releasing this soundscape.' });
      return;
    }

    const id = uid('mix');
    const result = await query<any>(
      `insert into mixes (id, creator_id, title, description, cover_image_url, status, recipe_data)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       returning *`,
      [id, user.id, title, description ?? '', coverImageUrl ?? DEFAULT_COVER, status, JSON.stringify(recipeData)],
    );
    let savedMix = mapMix(result.rows[0]);
    if (status === 'published' || status === 'private') {
      await freezeRecipeVersion(id, recipeData);
      savedMix = await getMixById(id) ?? savedMix;
    }
    res.status(201).json(savedMix);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/mixes/:id', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;

    const { title, description, status, recipeData, coverImageUrl } = req.body;
    const blocked = /\b(cure|treat|treatment|clinically proven|insomnia cure|anxiety cure|heal anxiety|guaranteed sleep)\b/i;
    if (blocked.test(`${title ?? mix.title} ${description ?? mix.description}`)) {
      res.status(400).json({ error: 'Medical claims are not allowed in titles or descriptions.' });
      return;
    }
    const effectiveStatus = status ?? mix.status;
    const entitlement = await getBillingEntitlement(owned.user.id, owned.user.subscription_tier);
    if ((effectiveStatus === 'published' || effectiveStatus === 'private')
      && mix.status !== 'published'
      && mix.status !== 'private'
      && entitlement.savedSounds.limit !== null
      && entitlement.savedSounds.used >= entitlement.savedSounds.limit) {
      res.status(402).json(entitlementError(
        'saved_sound_limit_reached',
        entitlement,
        `Free accounts can save ${FREE_SAVED_SOUND_LIMIT} sounds. Upgrade to Plus to save more.`,
      ));
      return;
    }
    const effectiveRecipeData = recipeData ?? mix.recipeData;
    const composerPilotRenderedAudioUrl = typeof recipeData?.quickCreate?.composerRenderPilot?.renderedAudioUrl === 'string'
      && String(recipeData.quickCreate.composerRenderPilot.renderedAudioUrl).startsWith('/audio/music/local-review/composer-result-render-proof-v1/prepared/')
      ? String(recipeData.quickCreate.composerRenderPilot.renderedAudioUrl)
      : '';
    if (
      (effectiveStatus === 'published' || effectiveStatus === 'private')
      && !hasAudibleRecipeContent(effectiveRecipeData)
    ) {
      res.status(400).json({ error: 'Add at least one audible track before releasing this soundscape.' });
      return;
    }

    const result = await query<any>(
      `update mixes set
        title = coalesce($2, title),
        description = coalesce($3, description),
        cover_image_url = coalesce($4, cover_image_url),
        status = coalesce($5, status),
        recipe_data = coalesce($6::jsonb, recipe_data),
        render_status = case when $6::jsonb is null then render_status when $7 <> '' then 'ready' else 'not_rendered' end,
        rendered_audio_url = case when $6::jsonb is null then rendered_audio_url when $7 <> '' then $7 else '' end,
        rendered_at = case when $6::jsonb is null then rendered_at when $7 <> '' then coalesce(rendered_at, now()) else null end,
        render_error = case when $6::jsonb is null then render_error else '' end,
        updated_at = now()
       where id = $1
       returning *`,
      [
        req.params.id,
        title ?? null,
        description ?? null,
        coverImageUrl ?? null,
        status ?? null,
        recipeData ? JSON.stringify(recipeData) : null,
        composerPilotRenderedAudioUrl,
      ],
    );
    let updatedMix = mapMix(result.rows[0]);
    if (effectiveStatus === 'private' && mix.status !== 'private') {
      await query(
        `update share_links set revoked_at = now()
         where mix_id = $1 and visibility = 'public' and revoked_at is null`,
        [req.params.id],
      );
    }
    const becameSaved = (effectiveStatus === 'published' || effectiveStatus === 'private')
      && mix.status !== 'published'
      && mix.status !== 'private';
    if ((effectiveStatus === 'published' || effectiveStatus === 'private') && (recipeData || becameSaved)) {
      await freezeRecipeVersion(req.params.id, effectiveRecipeData);
      await recordSavedInternalBaselinePreference(owned.user.id, req.params.id, effectiveRecipeData);
      updatedMix = await getMixById(req.params.id) ?? updatedMix;
    }
    res.json(updatedMix);
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/play', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const mix = await getMixById(req.params.id);
    if (!mix || (mix.status !== 'published' && mix.creatorId !== user.id)) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }

    const durationListened = Number(req.body.durationListened ?? 0);
    const completed50 = durationListened >= mix.recipeData.durationSeconds * 0.5;
    const completed90 = durationListened >= mix.recipeData.durationSeconds * 0.9;
    await query(
      `update mixes set
        plays_count = plays_count + $2,
        completion_50_count = completion_50_count + $3,
        completion_90_count = completion_90_count + $4,
        updated_at = now()
       where id = $1`,
      [req.params.id, durationListened > 0 ? 0 : 1, completed50 ? 1 : 0, completed90 ? 1 : 0],
    );
    await query(
      'insert into user_history (id, user_id, mix_id, duration_listened) values ($1, $2, $3, $4)',
      [uid('hist'), user.id, req.params.id, durationListened],
    );
    res.json(await getMixById(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/fit-feedback', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const mix = await getMixById(req.params.id);
    if (!mix || (mix.status !== 'published' && mix.creatorId !== user.id)) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    const feedback = String(req.body.feedback ?? '').trim();
    if (!FIT_FEEDBACK_VALUES.has(feedback)) {
      res.status(400).json({ error: 'A valid fit feedback value is required.' });
      return;
    }
    const listenedSeconds = Math.max(0, Math.round(Number(req.body.listenedSeconds) || 0));
    const journeyId = String(req.body.journeyId ?? '').trim();
    const evidence = evidenceForFitFeedback(feedback, mix.recipeData);
    const inserted = await query<any>(
      `insert into preference_evidence (id, user_id, kind, value, source, stable, mix_id, details)
       values ($1, $2, $3, $4, 'playback_behavior', $5, $6, $7::jsonb)
       returning *`,
      [
        uid('pref'),
        user.id,
        evidence.kind,
        evidence.value,
        evidence.stable,
        mix.id,
        JSON.stringify({
          ...evidence.details,
          feedback,
          listenedSeconds,
          journeyId: /^[a-zA-Z0-9_-]{8,80}$/.test(journeyId) ? journeyId : null,
          goal: (mix.recipeData as any).audioIntent?.goal ?? null,
          scene: (mix.recipeData as any).audioIntent?.scene ?? null,
        }),
      ],
    );
    res.status(201).json({ recorded: true, evidence: mapPreferenceEvidence(inserted.rows[0]) });
  } catch (error) {
    next(error);
  }
});

const PLAYBACK_EVENT_TYPES = new Set([
  'quick_create_started',
  'recipe_ready',
  'playback_requested',
  'playback_started',
  'playback_failed',
  'playback_checkpoint',
  'native_media_session_ready',
  'native_media_session_failed',
  'result_accepted',
  'result_adjust_requested',
  'result_adjust_applied',
  'result_adjust_failed',
  'result_retry_requested',
  'work_saved',
  'work_published',
  'share_created',
]);
const MAX_PLAYBACK_EVENT_ELAPSED_MS = 8 * 60 * 60 * 1000;

app.post('/api/mixes/:id/playback-events', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const mix = await getMixById(req.params.id);
    if (!mix || (mix.status !== 'published' && mix.creatorId !== user.id)) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    const journeyId = String(req.body.journeyId ?? '').trim();
    const events = Array.isArray(req.body.events) ? req.body.events : [];
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(journeyId) || events.length === 0 || events.length > 10) {
      res.status(400).json({ error: 'A valid journeyId and 1-10 playback events are required.' });
      return;
    }
    for (const event of events) {
      const eventType = String(event.type ?? '');
      const elapsedMs = Math.round(Number(event.elapsedMs));
      if (!PLAYBACK_EVENT_TYPES.has(eventType) || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > MAX_PLAYBACK_EVENT_ELAPSED_MS) {
        res.status(400).json({ error: `Invalid playback event: ${eventType || 'missing type'}.` });
        return;
      }
      await query(
        `insert into playback_events (id, mix_id, user_id, journey_id, event_type, elapsed_ms, details)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [uid('pbe'), mix.id, user.id, journeyId, eventType, elapsedMs, JSON.stringify(event.details ?? {})],
      );
      incrementMetric('snooze_playback_events_ingested_total', { event_type: eventType });
    }
    res.status(201).json({ recorded: events.length, journeyId });
  } catch (error) {
    next(error);
  }
});

app.get('/api/playback-events/journeys/:journeyId', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const journeyId = String(req.params.journeyId ?? '').trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(journeyId)) {
      res.status(400).json({ error: 'A valid journeyId is required.' });
      return;
    }
    const result = await query<{
      event_type: string;
      elapsed_ms: number;
      details: Record<string, unknown>;
      created_at: Date;
    }>(
      `select event_type, elapsed_ms, details, created_at
       from playback_events
       where user_id = $1 and journey_id = $2
       order by elapsed_ms, created_at, id`,
      [user.id, journeyId],
    );
    res.json({
      journeyId,
      events: result.rows.map((event) => ({
        type: event.event_type,
        elapsedMs: event.elapsed_ms,
        details: event.details,
        createdAt: event.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/playback-metrics/summary', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const result = await query<any>(
      `select journey_id,
        min(elapsed_ms) filter (where event_type = 'recipe_ready') as recipe_ready_ms,
        min(elapsed_ms) filter (where event_type = 'playback_started') as playback_started_ms,
        (array_agg(details order by elapsed_ms, created_at, id) filter (where event_type = 'quick_create_started'))[1] as request_details,
        (array_agg(details order by elapsed_ms, created_at, id) filter (where event_type = 'recipe_ready'))[1] as recipe_details,
        array_agg(details order by elapsed_ms, created_at, id) filter (
          where event_type = 'result_adjust_requested' and details ? 'instruction'
        ) as adjustment_details,
        array_agg(event_type order by elapsed_ms, created_at, id) filter (
          where event_type in ('result_accepted', 'result_adjust_requested', 'result_retry_requested')
        ) as decision_events,
        array_agg(details order by elapsed_ms, created_at, id) filter (
          where event_type in ('playback_failed', 'result_adjust_failed')
        ) as failure_details,
        bool_or(event_type = 'playback_requested') as requested,
        bool_or(event_type = 'playback_failed') as failed,
        bool_or(event_type = 'result_accepted') as accepted,
        bool_or(event_type = 'result_adjust_requested') as adjust_requested,
        bool_or(event_type = 'result_adjust_applied') as adjust_applied,
        bool_or(event_type = 'result_adjust_failed') as adjust_failed,
        bool_or(event_type = 'result_retry_requested') as retry_requested,
        bool_or(event_type = 'work_saved') as saved,
        bool_or(event_type = 'work_published') as published,
        bool_or(event_type = 'share_created') as share_created,
        (select count(*)::int from user_history where user_history.user_id = $1 and user_history.mix_id = min(playback_events.mix_id) and duration_listened = 0) as playback_count
       from playback_events
       where user_id = $1
       group by journey_id`,
      [user.id],
    );
    const allJourneys = result.rows.map((row) => {
      const firstDecisionEvent = Array.isArray(row.decision_events) ? row.decision_events[0] : null;
      const firstDecision = firstDecisionEvent === 'result_accepted'
        ? 'accepted'
        : firstDecisionEvent === 'result_adjust_requested'
          ? 'adjusted'
          : firstDecisionEvent === 'result_retry_requested'
            ? 'retried'
            : null;
      return {
        journeyId: row.journey_id,
        recipeReadyMs: row.recipe_ready_ms == null ? null : Number(row.recipe_ready_ms),
        playbackStartedMs: row.playback_started_ms == null ? null : Number(row.playback_started_ms),
        requested: Boolean(row.requested),
        failed: Boolean(row.failed),
        accepted: Boolean(row.accepted),
        adjustRequested: Boolean(row.adjust_requested),
        adjustmentApplied: Boolean(row.adjust_applied),
        adjustmentFailed: Boolean(row.adjust_failed),
        retryRequested: Boolean(row.retry_requested),
        firstDecision,
        firstResultAccepted: firstDecision === 'accepted',
        saved: Boolean(row.saved),
        published: Boolean(row.published),
        shareCreated: Boolean(row.share_created),
        playbackCount: Number(row.playback_count ?? 0),
        request: row.request_details ?? null,
        recipe: row.recipe_details ?? null,
        adjustments: Array.isArray(row.adjustment_details) ? row.adjustment_details : [],
        failures: Array.isArray(row.failure_details) ? row.failure_details : [],
      };
    });
    const cohortFilter = typeof req.query.cohort === 'string' ? req.query.cohort.trim() : '';
    const participantFilter = typeof req.query.participant === 'string' ? req.query.participant.trim() : '';
    const sourceFilter = typeof req.query.source === 'string' ? req.query.source.trim() : '';
    const includeSynthetic = req.query.includeSynthetic === '1';
    const journeys = allJourneys.filter((journey) => {
      const source = String(journey.request?.source ?? '');
      const cohort = String(journey.request?.validationCohort ?? '');
      const participant = String(journey.request?.validationParticipant ?? '');
      if (!includeSynthetic && (source === 'validation' || journey.journeyId.startsWith('validation_'))) return false;
      return (!cohortFilter || cohort === cohortFilter)
        && (!participantFilter || participant === participantFilter)
        && (!sourceFilter || source === sourceFilter);
    });
    const successfulTimes = journeys
      .map((journey) => journey.playbackStartedMs)
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b);
    const recipeReadyTimes = journeys
      .map((journey) => journey.recipeReadyMs)
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b);
    const requestedJourneys = journeys.filter((journey) => journey.requested);
    const failedJourneys = requestedJourneys.filter((journey) => journey.failed && journey.playbackStartedMs == null);
    const resolvedAttempts = successfulTimes.length + failedJourneys.length;
    const decidedJourneys = journeys.filter((journey) => journey.accepted || journey.adjustRequested || journey.retryRequested);
    const acceptedJourneys = decidedJourneys.filter((journey) => journey.accepted);
    const firstAcceptedJourneys = decidedJourneys.filter((journey) => journey.firstResultAccepted);
    const adjustedJourneys = journeys.filter((journey) => journey.adjustRequested);
    const adjustedThenSavedJourneys = adjustedJourneys.filter((journey) => journey.saved);
    const savedJourneys = journeys.filter((journey) => journey.saved);
    const replayedJourneys = savedJourneys.filter((journey) => journey.playbackCount >= 2);
    const adjustmentResolvedJourneys = adjustedJourneys.filter((journey) => journey.adjustmentApplied || journey.adjustmentFailed);
    const failureReasonCounts = journeys.flatMap((journey) => journey.failures)
      .map((details) => String(details?.reason ?? 'unknown'))
      .reduce<Record<string, number>>((counts, reason) => {
        counts[reason] = (counts[reason] ?? 0) + 1;
        return counts;
      }, {});
    const accountRetention = await query<any>(
      `select
        count(*)::int as total_playbacks,
        count(distinct date(played_at))::int as play_days_30,
        coalesce(sum(duration_listened), 0)::int as listened_seconds_30
       from user_history
       where user_id = $1 and played_at >= now() - interval '30 days'`,
      [user.id],
    );
    const savedSoundsResult = await query<any>(
      `select count(*)::int as saved_sounds
       from mixes
       where creator_id = $1 and status in ('published', 'private')`,
      [user.id],
    );
    const evidenceCountsResult = await query<any>(
      `select
        count(*)::int as total,
        count(*) filter (where source = 'explicit_profile')::int as explicit_profile,
        count(*) filter (where source = 'saved_sound')::int as saved_sound,
        count(*) filter (where source = 'playback_behavior')::int as playback_behavior,
        count(*) filter (where kind = 'exclusion')::int as exclusions
       from preference_evidence
       where user_id = $1`,
      [user.id],
    );
    const accountRetentionRow = accountRetention.rows[0] ?? {};
    const evidenceCounts = evidenceCountsResult.rows[0] ?? {};
    const acceptedOrSavedJourneys = decidedJourneys.filter((journey) => journey.accepted || journey.saved);
    const acceptOrSaveRate = decidedJourneys.length === 0 ? null : Math.round((acceptedOrSavedJourneys.length / decidedJourneys.length) * 1000) / 10;
    const playDays30 = Number(accountRetentionRow.play_days_30 ?? 0);
    const savedSounds = Number(savedSoundsResult.rows[0]?.saved_sounds ?? 0);
    const preferenceEvidenceTotal = Number(evidenceCounts.total ?? 0);
    const enoughDecisionData = decidedJourneys.length >= 10;
    const acceptanceGatePassed = acceptOrSaveRate != null && acceptOrSaveRate >= 40;
    const replayGatePassed = playDays30 >= 3;
    const preferenceGatePassed = preferenceEvidenceTotal >= 3 && (Number(evidenceCounts.exclusions ?? 0) > 0 || Number(evidenceCounts.saved_sound ?? 0) > 0 || Number(evidenceCounts.playback_behavior ?? 0) > 0);
    const paymentReadiness = !enoughDecisionData
      ? 'collecting_data'
      : acceptanceGatePassed && replayGatePassed && preferenceGatePassed
        ? 'ready_to_test_paywall'
        : 'not_ready';
    const recommendations = [
      !enoughDecisionData ? `Collect ${Math.max(0, 10 - decidedJourneys.length)} more decided journeys before making a payment decision.` : '',
      !acceptanceGatePassed ? 'Improve first-result fit until accepted-or-saved reaches at least 40%.' : '',
      !replayGatePassed ? 'Validate repeat use: this account needs playback on three different days within 30 days.' : '',
      !preferenceGatePassed ? 'Create more explicit preference memory through saves, fit feedback, or exclusions.' : '',
    ].filter(Boolean);
    const percentile = (values: number[], ratio: number) => values.length === 0
      ? null
      : values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
    res.json({
      filters: {
        cohort: cohortFilter || null,
        participant: participantFilter || null,
        source: sourceFilter || null,
        includeSynthetic,
      },
      totalJourneys: journeys.length,
      playbackRequestedJourneys: requestedJourneys.length,
      successfulJourneys: successfulTimes.length,
      failedJourneys: failedJourneys.length,
      pendingPlaybackJourneys: requestedJourneys.filter((journey) => !journey.failed && journey.playbackStartedMs == null).length,
      awaitingUserPlayJourneys: journeys.filter((journey) => !journey.requested).length,
      successRate: resolvedAttempts === 0 ? null : Math.round((successfulTimes.length / resolvedAttempts) * 1000) / 10,
      resultDecisions: {
        decidedJourneys: decidedJourneys.length,
        acceptedJourneys: acceptedJourneys.length,
        firstAcceptedJourneys: firstAcceptedJourneys.length,
        adjustRequestedJourneys: decidedJourneys.filter((journey) => journey.adjustRequested).length,
        retryRequestedJourneys: decidedJourneys.filter((journey) => journey.retryRequested).length,
        firstResultAcceptanceRate: decidedJourneys.length === 0 ? null : Math.round((firstAcceptedJourneys.length / decidedJourneys.length) * 1000) / 10,
      },
      resultOutcomes: {
        savedJourneys: savedJourneys.length,
        saveRate: decidedJourneys.length === 0 ? null : Math.round((savedJourneys.length / decidedJourneys.length) * 1000) / 10,
        adjustedThenSavedJourneys: adjustedThenSavedJourneys.length,
        adjustedThenSavedRate: adjustedJourneys.length === 0 ? null : Math.round((adjustedThenSavedJourneys.length / adjustedJourneys.length) * 1000) / 10,
        replayedJourneys: replayedJourneys.length,
        replayRate: savedJourneys.length === 0 ? null : Math.round((replayedJourneys.length / savedJourneys.length) * 1000) / 10,
        publishedJourneys: journeys.filter((journey) => journey.published).length,
        shareCreatedJourneys: journeys.filter((journey) => journey.shareCreated).length,
      },
      adjustments: {
        requestedJourneys: adjustedJourneys.length,
        appliedJourneys: adjustedJourneys.filter((journey) => journey.adjustmentApplied).length,
        failedJourneys: adjustedJourneys.filter((journey) => journey.adjustmentFailed).length,
        successRate: adjustmentResolvedJourneys.length === 0 ? null : Math.round((adjustmentResolvedJourneys.filter((journey) => journey.adjustmentApplied).length / adjustmentResolvedJourneys.length) * 1000) / 10,
      },
      failureReasons: Object.entries(failureReasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
      retentionReadiness: {
        paymentReadiness,
        enoughDecisionData,
        recommendations,
        gates: {
          acceptedOrSaved: {
            value: acceptOrSaveRate,
            target: 40,
            passed: acceptanceGatePassed,
            numerator: acceptedOrSavedJourneys.length,
            denominator: decidedJourneys.length,
          },
          threeDayReplay: {
            value: playDays30,
            target: 3,
            passed: replayGatePassed,
          },
          preferenceMemory: {
            value: preferenceEvidenceTotal,
            target: 3,
            passed: preferenceGatePassed,
          },
        },
        account30Day: {
          totalPlaybacks: Number(accountRetentionRow.total_playbacks ?? 0),
          playDays: playDays30,
          listenedSeconds: Number(accountRetentionRow.listened_seconds_30 ?? 0),
          savedSounds,
        },
        preferenceEvidence: {
          total: preferenceEvidenceTotal,
          explicitProfile: Number(evidenceCounts.explicit_profile ?? 0),
          savedSound: Number(evidenceCounts.saved_sound ?? 0),
          playbackBehavior: Number(evidenceCounts.playback_behavior ?? 0),
          exclusions: Number(evidenceCounts.exclusions ?? 0),
        },
      },
      timeToRecipeReadyMs: {
        p50: percentile(recipeReadyTimes, 0.5),
        p95: percentile(recipeReadyTimes, 0.95),
      },
      timeToFirstPlaybackMs: {
        p50: percentile(successfulTimes, 0.5),
        p95: percentile(successfulTimes, 0.95),
      },
      journeys,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/favorite', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const result = await query<any>(
      `update mixes set likes_count = likes_count + 1, updated_at = now()
       where id = $1 and (status = 'published' or creator_id = $2) returning *`,
      [req.params.id, user.id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    res.json(mapMix(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/share', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const result = await query<any>(
      `update mixes set share_clicks = share_clicks + 1, updated_at = now()
       where id = $1 and (status = 'published' or creator_id = $2) returning *`,
      [req.params.id, user.id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    res.json(mapMix(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/export-check', async (req, res, next) => {
  try {
    const mix = await getMixById(req.params.id);
    const user = await getAuthenticatedUser(req);
    if (!mix || (mix.status !== 'published' && mix.creatorId !== user?.id)) {
      res.status(404).json({ error: 'Mix not found' });
      return;
    }
    res.json(await getExportCheck(mix));
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/replace-blocked-stems', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;

    const requestedStemId = String(req.body.stemId ?? '').trim();
    const requestedReplacementStemId = String(req.body.replacementStemId ?? '').trim();
    const exportCheck = await getExportCheck(mix);
    const targets = requestedStemId
      ? exportCheck.blockedStems.filter((stem: any) => stem.stemId === requestedStemId)
      : exportCheck.blockedStems;

    if (targets.length === 0) {
      res.status(400).json({ error: requestedStemId ? 'That stem is not currently blocking export.' : 'This mix has no blocked stems to replace.' });
      return;
    }

    const usedStemIds = new Set<string>(mix.recipeData.tracks.map((track: any) => String(track.stemId)));
    const replacements: Array<{ fromStemId: string; fromName: string; toStemId: string; toName: string }> = [];
    const replacementByStemId = new Map<string, any>();

    for (const target of targets as any[]) {
      let alternative = null;
      if (requestedReplacementStemId && targets.length === 1) {
        alternative = target.alternatives.find((stem: any) => stem.id === requestedReplacementStemId) ?? null;
        if (!alternative) {
          res.status(400).json({ error: `Selected replacement is not an approved ${target.category.toLowerCase()} alternative for ${target.name}.`, exportCheck });
          return;
        }
      } else {
        alternative = await findApprovedAlternativeStem(target, Array.from(usedStemIds));
      }
      if (!alternative) {
        res.status(400).json({ error: `No approved ${target.category.toLowerCase()} alternative is available for ${target.name}.`, exportCheck });
        return;
      }
      usedStemIds.add(alternative.id);
      replacementByStemId.set(target.stemId, alternative);
      replacements.push({
        fromStemId: target.stemId,
        fromName: target.name,
        toStemId: alternative.id,
        toName: alternative.name,
      });
    }

    const recipeData = {
      ...mix.recipeData,
      tracks: mix.recipeData.tracks.map((track: any) => {
        const replacement = replacementByStemId.get(String(track.stemId));
        return replacement ? { ...track, stemId: replacement.id } : track;
      }),
      audit: {
        ...(mix.recipeData.audit ?? {}),
        replacements: [
          ...((mix.recipeData.audit?.replacements ?? []) as any[]),
          ...replacements.map((replacement) => ({
            ...replacement,
            reason: 'export_blocked_stem_replacement',
            createdAt: new Date().toISOString(),
          })),
        ],
      },
    };

    const result = await query<any>(
      `update mixes set
        recipe_data = $2::jsonb,
        render_status = 'not_rendered',
        rendered_audio_url = '',
        rendered_at = null,
        render_error = '',
        updated_at = now()
       where id = $1
       returning *`,
      [req.params.id, JSON.stringify(recipeData)],
    );
    let updatedMix = mapMix(result.rows[0]);
    if (mix.status === 'published') {
      await freezeRecipeVersion(req.params.id, recipeData);
      updatedMix = await getMixById(req.params.id) ?? updatedMix;
    }
    res.json({
      mix: updatedMix,
      replacements,
      exportCheck: await getExportCheck(updatedMix),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/recipe-edits', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;

    const instruction = String(req.body.instruction ?? '').trim();
    const result = applyDeterministicRecipeEdit(mix.recipeData, instruction, {
      approvedEnvironmentStemIds: await getApprovedEnvironmentStemIds(),
    });
    const updated = await query<any>(
      `update mixes set
         recipe_data = $2::jsonb,
         render_status = 'not_rendered',
         rendered_audio_url = '',
         rendered_at = null,
         render_error = '',
         updated_at = now()
       where id = $1
       returning *`,
      [mix.id, JSON.stringify(result.recipe)],
    );
    let updatedMix = mapMix(updated.rows[0]);
    if (mix.status === 'published') {
      await freezeRecipeVersion(mix.id, result.recipe);
      updatedMix = await getMixById(mix.id) ?? updatedMix;
    }
    res.json({ mix: updatedMix, edit: result.edit, tracks: mixToTracks(updatedMix, await getStemsForMixTracks(updatedMix)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recipe edit failed';
    if (message.includes('deterministic edit set') || message.includes('Edit instruction')) {
      res.status(400).json({ error: message });
      return;
    }
    next(error);
  }
});

app.post('/api/mixes/:id/recipe-edits/undo', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const undoStack = [...(((mix.recipeData.audit as any)?.undoStack ?? []) as any[])];
    const previous = undoStack.pop();
    if (!previous) {
      res.status(400).json({ error: 'No deterministic recipe edit is available to undo.' });
      return;
    }
    const recipeData = {
      ...previous,
      versionState: 'live',
      audit: {
        ...(previous.audit ?? {}),
        edits: ((mix.recipeData.audit as any)?.edits ?? []).slice(0, -1),
        undoStack,
      },
    };
    const updated = await query<any>(
      `update mixes set
         recipe_data = $2::jsonb,
         render_status = 'not_rendered',
         rendered_audio_url = '',
         rendered_at = null,
         render_error = '',
         updated_at = now()
       where id = $1
       returning *`,
      [mix.id, JSON.stringify(recipeData)],
    );
    let updatedMix = mapMix(updated.rows[0]);
    if (mix.status === 'published') {
      await freezeRecipeVersion(mix.id, recipeData);
      updatedMix = await getMixById(mix.id) ?? updatedMix;
    }
    res.json({ mix: updatedMix, tracks: mixToTracks(updatedMix, await getStemsForMixTracks(updatedMix)) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/mixes/:id/render', async (req, res, next) => {
  const renderStartedAt = process.hrtime.bigint();
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;

    if (mix.status === 'published' || mix.status === 'private') {
      mix.recipeData = await getPublishedRecipe(mix);
    }

    await query(
      `update mixes set render_status = 'rendering', render_error = '', updated_at = now() where id = $1`,
      [req.params.id],
    );

    const stemIds = Array.from(new Set<string>(mix.recipeData.tracks.map((track: any) => String(track.stemId))));
    const stems = await getStemRowsByIds(stemIds);
    const exportCheck = await getExportCheck(mix);

    try {
      const { renderedAudioUrl, qaReport, bytes } = await observeOperation('render', () => renderMixToMp3(mix, stems));
      await query(
        `insert into render_qa_reports (
           id, mix_id, recipe_version_id, rendered_audio_url, duration_seconds,
           peak_db, mean_db, integrated_lufs, true_peak_db, abnormal_silence_count, passed, details
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
        [
          uid('qar'), req.params.id, mix.recipeData.versionId ?? null, renderedAudioUrl,
          qaReport.durationSeconds, qaReport.peakDb, qaReport.meanDb, qaReport.integratedLufs,
          qaReport.truePeakDb, qaReport.abnormalSilenceCount, qaReport.passed, JSON.stringify({ analyzer: 'ffmpeg' }),
        ],
      );
      if (!qaReport.passed) {
        await exportStorage.deleteUrl(renderedAudioUrl);
        throw new Error(
          `Rendered audio failed acoustic QA: ${qaReport.abnormalSilenceCount} interior silences, peak ${qaReport.peakDb ?? 'unknown'} dB.`,
        );
      }
      const recipeData = {
        ...mix.recipeData,
        audit: {
          ...(mix.recipeData.audit ?? {}),
          renders: [
            ...((mix.recipeData.audit?.renders ?? []) as any[]),
            {
              status: 'ready',
              renderedAudioUrl,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      };
      const result = await query<any>(
        `update mixes set
          render_status = 'ready',
          rendered_audio_url = $2,
          rendered_at = now(),
          render_error = '',
          recipe_data = $3::jsonb,
          updated_at = now()
         where id = $1
         returning *`,
        [req.params.id, renderedAudioUrl, JSON.stringify(recipeData)],
      );
      res.json({
        mix: mapMix(result.rows[0]),
        renderedAudioUrl,
        qaReport,
        bytes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Render failed';
      const recipeData = {
        ...mix.recipeData,
        audit: {
          ...(mix.recipeData.audit ?? {}),
          renders: [
            ...((mix.recipeData.audit?.renders ?? []) as any[]),
            {
              status: 'failed',
              error: message,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      };
      const result = await query<any>(
        `update mixes set
          render_status = 'failed',
          render_error = $2,
          recipe_data = $3::jsonb,
          updated_at = now()
         where id = $1
         returning *`,
        [req.params.id, message, JSON.stringify(recipeData)],
      );
      res.status(400).json({
        error: message,
        mix: mapMix(result.rows[0]),
        exportCheck,
      });
    } finally {
      observeMetric('snooze_render_route_duration_seconds', Number(process.hrtime.bigint() - renderStartedAt) / 1_000_000_000);
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/download', async (req, res, next) => {
  try {
    const mix = await requireDownloadableMix(req, res);
    if (!mix) return;
    if (mix.renderStatus !== 'ready' || !mix.renderedAudioUrl) {
      res.status(409).json({ error: 'Mix has not been rendered yet.' });
      return;
    }

    const fileName = `${safeDownloadBaseName(mix)}.mp3`;
    const filePath = exportStorage.localPathForUrl(mix.renderedAudioUrl);
    if (filePath) {
      res.download(filePath, fileName);
      return;
    }
    res.redirect(302, mix.renderedAudioUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/credits.json', async (req, res, next) => {
  try {
    const mix = await requireDownloadableMix(req, res);
    if (!mix) return;
    const sidecar = await getWorkAttributionSidecar(mix);
    res
      .type('application/json')
      .attachment(`${safeDownloadBaseName(mix)}.credits.json`)
      .send(`${JSON.stringify(sidecar, null, 2)}\n`);
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/credits.txt', async (req, res, next) => {
  try {
    const mix = await requireDownloadableMix(req, res);
    if (!mix) return;
    const sidecar = await getWorkAttributionSidecar(mix);
    const appOrigin = `${req.protocol}://${req.get('host') ?? ''}`;
    res
      .type('text/plain')
      .attachment(`${safeDownloadBaseName(mix)}.credits.txt`)
      .send(formatWorkAttributionSidecarText(sidecar, appOrigin));
  } catch (error) {
    next(error);
  }
});

app.get('/api/mixes/:id/analytics', async (req, res, next) => {
  try {
    const owned = await requireOwnedMix(req, res);
    if (!owned) return;
    const { mix } = owned;
    const requiredPlays = 100;
    const requiredFavorites = 5;
    const requiredCompletionRate = 30;
    const completionRate = mix.playsCount > 0 ? Math.round((mix.completion50Count / mix.playsCount) * 100) : 0;
    const missingPlays = Math.max(0, requiredPlays - mix.playsCount);
    const missingFavorites = Math.max(0, requiredFavorites - mix.likesCount);
    res.json({
      pageViews: Math.round(mix.playsCount * 1.8) + 12,
      playStarts: mix.playsCount,
      play50: mix.completion50Count,
      play90: mix.completion90Count,
      favorites: mix.likesCount,
      shareClicks: mix.shareClicks,
      curation: {
        requiredPlays,
        requiredFavorites,
        requiredCompletionRate,
        missingPlays,
        missingFavorites,
        completionRate,
        eligible: missingPlays === 0 && missingFavorites === 0 && completionRate >= requiredCompletionRate,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ai/sessions', async (req, res, next) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) return;
    const prompt = String(req.body.prompt ?? '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const classification = await observeOperation('generation', () => classifyRecipeIntent(prompt));
    const requestedGoal: ProductGoal = classification.goal === 'focus'
      ? 'focus'
      : classification.goal === 'meditation' || classification.goal === 'emotional_settling'
        ? 'calm'
        : 'sleep';
    const requestedScene: ProductScene = classification.goal === 'return_to_sleep'
      ? 'return_to_sleep'
      : classification.goal === 'meditation' || classification.goal === 'emotional_settling'
        ? 'emotional_settling'
        : requestedGoal === 'focus'
          ? 'deep_focus'
          : 'bedtime';
    const catalogScene = scenes.find((item) => item.id === requestedScene);
    const durationSeconds = Number(req.body.durationSeconds ?? catalogScene?.defaultDurationSeconds ?? 900);
    const languagePreference = normalizeLanguagePreference(req.body.languagePreference);
    const resolvedLanguage = normalizeResolvedLanguage(req.body.resolvedLanguage);
    const soundProfile = mapSoundProfile(await ensureSoundProfile(user.id));
    const planning = await observeOperation('generation', () => planQuickCreateSoundscape({
      prompt,
      requestedGoal,
      requestedScene,
      guidedVoice: false,
      voiceEnabled: productCapabilities.guidedVoice,
      durationSeconds,
      stableExcludedSounds: soundProfile.excludedSounds,
      stableLikedSounds: soundProfile.likedSounds,
    }));
    const savedBaselinePreferences = await getSavedInternalBaselinePreferences(user.id);
    const baselineSelection = selectInternalBaselineRecipe({
      prompt,
      audioIntent: planning.audioIntent,
      durationSeconds,
      savedBaselinePreferences,
    });
    const foundationalExcludedSounds = reconcileFoundationalExcludedSounds(prompt, planning.audioIntent.excludedSounds);
    const foundationalSelection = selectFoundationalElementRecipe({
      prompt,
      goal: planning.audioIntent.goal,
      scene: planning.audioIntent.scene,
      contentMode: planning.audioIntent.contentMode,
      excludedSounds: foundationalExcludedSounds,
      environmentPreferences: planning.audioIntent.environmentPreferences,
      selectionKey: String(res.locals.requestId ?? ''),
    });
    const musicKitRecipe = foundationalSelection || !explicitlyRequestsMusicKit(prompt, planning.audioIntent) ? null : selectMusicKitCatalogRecipe({
      prompt,
      goal: planning.audioIntent.goal,
      scene: planning.audioIntent.scene,
      contentMode: planning.audioIntent.contentMode,
      excludedSounds: planning.audioIntent.excludedSounds,
      selectionKey: String(res.locals.requestId ?? ''),
    });
    const composerBundlePlan = foundationalSelection ? buildFoundationalCompositionBundle({
      prompt,
      goal: planning.audioIntent.goal,
      scene: planning.audioIntent.scene,
      excludedSounds: foundationalExcludedSounds,
      preferredSounds: planning.audioIntent.environmentPreferences,
      selectionKey: String(res.locals.requestId ?? ''),
    }) : null;
    const recipe = foundationalSelection?.recipe ?? musicKitRecipe ?? baselineSelection?.recipe ?? planning.recipe;
    const audioIntent: PlannedAudioIntent = foundationalSelection || musicKitRecipe || baselineSelection
      ? {
          ...planning.audioIntent,
          contentMode: recipe.contentMode,
          excludedSounds: foundationalSelection ? foundationalExcludedSounds : planning.audioIntent.excludedSounds,
          excludedConceptIds: foundationalSelection
            ? foundationalExcludedSounds.map((item) => `source.${item}`)
            : planning.audioIntent.excludedConceptIds,
          planner: {
            ...planning.audioIntent.planner,
            explanation: foundationalSelection
              ? `${planning.audioIntent.planner.explanation} Built ${foundationalSelection.plan.id} from three approved reusable elements without a runtime music API call.`
              : musicKitRecipe
                ? `${planning.audioIntent.planner.explanation} Selected an approved synchronized MusicKit for the explicit music request.`
                : `${planning.audioIntent.planner.explanation} Selected owner-approved internal content baseline seed ${baselineSelection!.seed.id} for legacy AI session generation.`,
          },
        }
      : planning.audioIntent;
    await assertRecipeMatchesIntent(recipe, audioIntent);
    const generationDecision = await decideGeneration({
      prompt,
      goal: audioIntent.goal,
      scene: audioIntent.scene,
      contentMode: audioIntent.contentMode,
      requiredConceptIds: audioIntent.requiredConceptIds,
      excludedConceptIds: audioIntent.excludedConceptIds,
    });
    const result = await createDraftFromCatalogRecipe({
      userId: user.id,
      recipe,
      durationSeconds,
      prompt,
      guidedVoice: false,
      languagePreference,
      resolvedLanguage,
      soundProfile,
      audioIntent,
      generationDecision,
    });
    const mixId = result.mix.id;
    const sessionResult = await query<any>(
      `insert into ai_sessions (id, user_id, prompt, chat_history, generated_mix_id)
       values ($1, $2, $3, $4::jsonb, $5)
       returning *`,
      [
        uid('ai'),
        user.id,
        prompt,
        JSON.stringify([
          { role: 'user', content: prompt },
          {
            role: 'assistant',
            content: baselineSelection
              ? `Selected an owner-approved ${audioIntent.goal} baseline soundscape: ${baselineSelection.seed.title}.`
              : `Created a ${result.mix.recipeData.tracks.length}-layer ${audioIntent.goal} soundscape from approved audio layers.`,
          },
        ]),
        mixId,
      ],
    );
    res.status(201).json({
      session: {
        id: sessionResult.rows[0].id,
        userId: sessionResult.rows[0].user_id,
        prompt: sessionResult.rows[0].prompt,
        chatHistory: sessionResult.rows[0].chat_history,
        generatedMixId: sessionResult.rows[0].generated_mix_id,
        createdAt: sessionResult.rows[0].created_at,
      },
      mix: result.mix,
      stems: result.stems,
      tracks: result.tracks,
      audioIntent,
      generationDecision,
      planning: {
        requestId: planning.requestId,
        provider: audioIntent.planner.provider,
        model: audioIntent.planner.model,
          selected: foundationalSelection
            ? foundationalSelection.plan.selected.map((element) => ({ stemId: element.stemId, role: 'music', reason: element.reason }))
            : musicKitRecipe
              ? musicKitRecipe.tracks.map((track) => ({ stemId: track.stemId, role: track.role, reason: `Approved MusicKit ${track.musicKitId}.` }))
            : baselineSelection
            ? [{ stemId: baselineSelection.seed.stemId, role: 'music', reason: 'Owner-approved internal audible product baseline seed.' }]
            : planning.selected,
        rejectedCount: planning.rejected.length,
        internalBaselineSeed: foundationalSelection || musicKitRecipe ? null : baselineSelection?.seed.id ?? null,
        elementCompositionPlan: foundationalSelection?.plan ?? null,
        composerBundlePlan,
        musicKitId: musicKitRecipe?.tracks[0]?.musicKitId ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ai/status', (_req, res) => {
  res.json(getAiRecipeStatus());
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = String(res.locals.requestId ?? 'unknown');
  const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
    ? Math.min(599, Math.max(400, (error as { statusCode: number }).statusCode))
    : 500;
  logEvent('error', 'request_error', {
    request_id: requestId,
    error_class: classifyError(error),
    error_name: error instanceof Error ? error.name : 'UnknownError',
  });
  res.status(statusCode).json({
    error: runtimeConfig.production && statusCode >= 500 ? 'Internal server error' : error instanceof Error ? error.message : 'Internal server error',
    code: statusCode >= 500 ? 'internal_server_error' : 'request_rejected',
    requestId,
  });
});

const port = runtimeConfig.port;

const prepareDatabase = runtimeConfig.production
  ? query('select 1')
  : createSchema()
    .then(seedDatabase)
    .then(seedAudioKnowledgeV3)
    .then(seedAudioIntentGoldSetV3);
const prepareRuntime = runtimeConfig.production && !existsSync(PRODUCTION_AUDIO_SMOKE_PATH)
  ? Promise.reject(new Error('Packaged production audio is missing from the runtime image.'))
  : prepareDatabase;

prepareRuntime
  .then(async () => {
    if (!runtimeConfig.production) await syncDiscoverPlacements(await loadDiscoverConfig());
  })
  .then(() => {
    app.listen(port, () => {
      setMetricGauge('snooze_database_ready', 1);
      logEvent('info', 'server_started', { port, production: runtimeConfig.production, storage_driver: storageConfig.driver });
    });
  })
  .catch((error: unknown) => {
    setMetricGauge('snooze_database_ready', 0);
    const errorMessage = error instanceof Error
      ? error.message.replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, 'postgresql://[redacted]').slice(0, 240)
      : 'Unknown startup error';
    logEvent('error', 'server_start_failed', {
      error_class: classifyError(error),
      error_name: error instanceof Error ? error.name : 'UnknownError',
      error_message: errorMessage,
    });
    pool.end();
    process.exit(1);
  });
