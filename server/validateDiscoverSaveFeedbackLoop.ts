import { pool, query } from './db';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.SNOOZE_API_BASE ?? process.env.API_BASE ?? 'http://localhost:8788';
const REQUIRED_SECTION = 'sleep-ready';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let authToken = '';
let userId = '';
let savedMixId = '';

const fail = (message: string): never => {
  throw new Error(`Discover save and feedback loop validation failed: ${message}`);
};

const request = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) fail(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${payload?.error ?? response.statusText}`);
  return payload as T;
};

try {
  const discoverSource = await readFile(path.join(root, 'src/pages/DiscoverPage.tsx'), 'utf8');
  if (!discoverSource.includes('SaveToMySoundsButton')) fail('Explore does not expose a visible save-to-My-Sounds control');
  if (!discoverSource.includes('Heart')) fail('Explore save control should use a heart affordance');
  if (!discoverSource.includes('Save to My Sounds')) fail('Explore save control is missing the user-facing My Sounds label');

  const guest = await request<{ token: string; user: { id: string } }>('/api/auth/guest', {
    method: 'POST',
    body: '{}',
  });
  authToken = guest.token;
  userId = guest.user.id;

  const discover = await request<{
    sections: Array<{ id: string; mixes: Array<{ id: string }> }>;
  }>('/api/discover');
  const section = discover.sections.find((item) => item.id === REQUIRED_SECTION);
  const sourceMixId = section?.mixes?.[0]?.id ?? '';
  if (!sourceMixId) fail(`${REQUIRED_SECTION} did not expose a published starter mix`);

  const detail = await request<{
    mix: {
      id: string;
      creatorId: string;
      title: string;
      description: string;
      coverImageUrl?: string;
      status: string;
      renderStatus: string;
      renderedAudioUrl: string;
      publishedVersionId: string | null;
      recipeData: Record<string, unknown>;
    };
    tracks: Array<{ url: string; role?: string }>;
  }>(`/api/mixes/${encodeURIComponent(sourceMixId)}`);
  if (detail.mix.status !== 'published') fail(`${sourceMixId} is not a published Discover starter`);
  if (detail.mix.creatorId === userId) fail(`${sourceMixId} should be foreign to the new guest before saving`);
  if (detail.mix.renderStatus !== 'ready' || !detail.mix.renderedAudioUrl) fail(`${sourceMixId} is not rendered for player handoff`);
  if (!detail.mix.publishedVersionId) fail(`${sourceMixId} is not frozen before Discover playback`);
  if (!detail.tracks.length) fail(`${sourceMixId} has no player tracks`);

  const feedback = await request<{
    recorded: boolean;
    evidence: { source: string; kind: string; mixId: string | null; details: Record<string, unknown> };
  }>(`/api/mixes/${encodeURIComponent(sourceMixId)}/fit-feedback`, {
    method: 'POST',
    body: JSON.stringify({
      feedback: 'fits_me',
      listenedSeconds: 90,
      journeyId: 'discover_save_feedback_loop',
    }),
  });
  if (!feedback.recorded) fail('fits_me feedback was not recorded');
  if (feedback.evidence.source !== 'playback_behavior') fail('fits_me feedback did not become playback behavior evidence');
  if (feedback.evidence.kind !== 'like') fail('fits_me feedback did not become positive evidence');
  if (feedback.evidence.mixId !== sourceMixId) fail('feedback evidence lost the Discover source mix id');

  const saved = await request<{
    id: string;
    creatorId: string;
    status: string;
    publishedVersionId: string | null;
    recipeData: Record<string, unknown>;
  }>('/api/mixes', {
    method: 'POST',
    body: JSON.stringify({
      title: detail.mix.title,
      description: detail.mix.description,
      coverImageUrl: detail.mix.coverImageUrl,
      status: 'private',
      recipeData: detail.mix.recipeData,
    }),
  });
  savedMixId = saved.id;
  if (saved.id === sourceMixId) fail('saving a Discover starter updated the source mix instead of creating a personal copy');
  if (saved.creatorId !== userId) fail('saved Discover starter is not owned by the current user');
  if (saved.status !== 'private') fail('saved Discover starter should be private by default');
  if (!saved.publishedVersionId) fail('saved Discover starter did not freeze a replayable version');
  if ((saved.recipeData as { versionState?: string }).versionState !== 'frozen') fail('saved Discover starter recipe is not frozen');

  const studio = await request<{ mixes: Array<{ id: string }> }>('/api/studio?all=true');
  if (!studio.mixes.some((mix) => mix.id === savedMixId)) fail('saved Discover starter is not visible in My Sounds');

  console.log(JSON.stringify({
    passed: true,
    apiBase: API_BASE,
    sourceMixId,
    savedMixId,
    evidence: {
      source: feedback.evidence.source,
      kind: feedback.evidence.kind,
      sourceMixId: feedback.evidence.mixId,
    },
    gates: [
      'explore_cards_expose_heart_save_control',
      'discover_starter_loads_in_player',
      'fits_me_creates_preference_evidence',
      'foreign_published_starter_saves_as_owned_private_copy',
      'saved_copy_is_frozen_and_visible_in_my_sounds',
    ],
  }, null, 2));
} finally {
  if (savedMixId) await query('delete from mixes where id = $1', [savedMixId]).catch(() => undefined);
  if (userId) {
    await query('delete from preference_evidence where user_id = $1', [userId]).catch(() => undefined);
    await query('delete from user_history where user_id = $1', [userId]).catch(() => undefined);
    await query('delete from users where id = $1', [userId]).catch(() => undefined);
  }
  await pool.end();
}
