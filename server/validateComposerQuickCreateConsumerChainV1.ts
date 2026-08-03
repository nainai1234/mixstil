import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8788';
const root = process.cwd();
const regressionId = 'composer-quick-create-consumer-chain-v1';

type Json = Record<string, any>;

let authToken = '';
let userId = '';
const mixIds: string[] = [];

const request = async <T extends Json | Json[]>(pathname: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body as T;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifestPath = path.join(root, 'public/audio/music/local-review/composer-result-render-proof-v1/manifest.json');
if (!existsSync(manifestPath)) throw new Error('Missing composer result render proof manifest.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Json;
assert(manifest.status === 'composer_result_render_proof_ready', 'Composer result proof is not ready.');
assert(manifest.productionAllowed === false && manifest.publicReleaseAllowed === false, 'Composer proof must remain non-production.');
assert(manifest.counts?.renders === 6 && manifest.counts?.machinePass === 6 && manifest.counts?.professionalRenderPass === 6, 'Composer proof counts drifted.');

type ComposerCase = {
  id: string;
  goal: string;
  scene: string;
  prompt: string;
  expectedProofId: string;
  expectedMode: 'music_supported' | 'support_only';
  saveAndReplay?: boolean;
};

const cases: ComposerCase[] = [
  {
    id: 'sleep_piano_warm_sparse',
    goal: 'sleep',
    scene: 'bedtime',
    prompt: '睡前需要温暖、低变化、没有人声的声音，稍微有一点柔和钢琴感，不要鼓点。',
    expectedProofId: 'sleep_piano_warm_sparse',
    expectedMode: 'music_supported',
    saveAndReplay: true,
  },
  {
    id: 'sleep_support_only_no_water_no_road',
    goal: 'sleep',
    scene: 'bedtime',
    prompt: '只要深一点的安静底层和柔和遮蔽，不要音乐、不要人声、不要鼓点、不要水声、不要公路感。',
    expectedProofId: 'sleep_support_only_no_water_no_road',
    expectedMode: 'support_only',
  },
  {
    id: 'calm_guitar_meditation',
    goal: 'calm',
    scene: 'breathing',
    prompt: '十分钟呼吸冥想，需要宽一点的空间感和很慢的吉他支撑，不要人声、不要鼓点。',
    expectedProofId: 'calm_guitar_meditation',
    expectedMode: 'music_supported',
  },
  {
    id: 'calm_528_support_only',
    goal: 'calm',
    scene: 'emotional_settling',
    prompt: '想要安静的 528 参数支撑和柔和空气感，不要音乐、不要人声、不要鼓点。',
    expectedProofId: 'calm_528_support_only',
    expectedMode: 'support_only',
  },
  {
    id: 'focus_rhodes_no_nature',
    goal: 'focus',
    scene: 'deep_focus',
    prompt: '专注写代码，需要低干扰的 Rhodes 氛围，不要自然声、不要人声、不要强节奏。',
    expectedProofId: 'focus_rhodes_no_nature',
    expectedMode: 'music_supported',
  },
  {
    id: 'focus_masking_no_melody',
    goal: 'focus',
    scene: 'deep_focus',
    prompt: '写代码时需要遮蔽外界干扰，不要旋律、不要水声、不要人声、不要强节奏。',
    expectedProofId: 'focus_masking_no_melody',
    expectedMode: 'support_only',
  },
];

const results: Json[] = [];
let savedReplayProof: Json | null = null;

try {
  const guest = await request<Json>('/api/auth/guest', { method: 'POST', body: '{}' });
  authToken = String(guest.token ?? '');
  userId = String(guest.user?.id ?? '');
  assert(authToken && userId, 'Guest auth did not return a user and token.');

  for (const item of cases) {
    const startedAt = performance.now();
    const created = await request<Json>('/api/quick-create', {
      method: 'POST',
      body: JSON.stringify({
        prompt: item.prompt,
        goal: item.goal,
        scene: item.scene,
        durationSeconds: 300,
        guidedVoice: false,
      }),
    });
    const quickCreateMs = Math.round(performance.now() - startedAt);
    const mixId = String(created.mix?.id ?? '');
    mixIds.push(mixId);
    assert(mixId, `${item.id} Quick Create did not return a mix id.`);

    const pilot = created.planning?.composerRenderPilot;
    assert(pilot?.source === 'composer_result_render_proof_v1', `${item.id} did not enter composer render pilot.`);
    assert(pilot?.proofId === item.expectedProofId, `${item.id} selected ${pilot?.proofId}, expected ${item.expectedProofId}.`);
    assert(pilot?.composerMode === item.expectedMode, `${item.id} selected mode ${pilot?.composerMode}, expected ${item.expectedMode}.`);
    assert(pilot?.professionalVerdict === 'render_proof_pass', `${item.id} did not keep professional render pass.`);
    assert(pilot?.productionAllowed === false && pilot?.publicReleaseAllowed === false, `${item.id} leaked production/public allowance.`);
    assert(created.planning?.composerBundlePlan?.mode === item.expectedMode, `${item.id} composer bundle mode mismatch.`);
    assert(created.generationDecision?.fullTrackProviderAllowed === false, `${item.id} allowed full-track provider unexpectedly.`);
    assert(created.mix?.recipeData?.schemaVersion === 2, `${item.id} did not persist Recipe V2.`);
    assert(created.mix?.recipeData?.quickCreate?.composerRenderPilot?.proofId === item.expectedProofId, `${item.id} lost recipe composer proof metadata.`);
    assert(created.mix?.renderStatus === 'ready', `${item.id} mix is not immediately rendered.`);
    assert(created.mix?.renderedAudioUrl === pilot.proofAudioUrl, `${item.id} rendered URL is not the selected proof URL.`);
    assert(String(created.mix.renderedAudioUrl).includes('/composer-result-render-proof-v1/prepared/'), `${item.id} rendered URL is not from composer proof prepared audio.`);
    assert((created.tracks ?? []).length >= 2, `${item.id} returned too few adjustable source tracks.`);
    assert(created.tracks.every((track: Json) => !String(track.url).includes('/composer-result-render-proof-v1/prepared/')), `${item.id} exposed final proof MP3 as an editable source track.`);
    if (item.expectedMode === 'support_only') {
      assert((pilot.selectedAtomicElementIds ?? []).length === 0, `${item.id} support-only route selected atomic music.`);
      assert(created.mix.recipeData.tracks.every((track: Json) => track.role !== 'music'), `${item.id} support-only recipe contains music track.`);
    } else {
      assert((pilot.selectedAtomicElementIds ?? []).length >= 3, `${item.id} music-supported route lacks atomic music spine.`);
      assert(created.mix.recipeData.tracks.some((track: Json) => track.role === 'music'), `${item.id} music-supported recipe has no music track.`);
    }

    const audioHead = await fetch(`${API_BASE}${created.mix.renderedAudioUrl}`, { method: 'HEAD' });
    assert(audioHead.ok, `${item.id} rendered proof audio is not reachable.`);
    const fetched = await request<Json>(`/api/mixes/${mixId}`);
    assert(fetched.mix?.renderStatus === 'ready', `${item.id} fetched mix lost ready render status.`);
    assert(fetched.mix?.renderedAudioUrl === created.mix.renderedAudioUrl, `${item.id} fetched mix lost rendered proof URL.`);

    if (item.saveAndReplay) {
      const saved = await request<Json>(`/api/mixes/${mixId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Composer Quick Create Consumer Chain Proof',
          status: 'private',
          recipeData: created.mix.recipeData,
        }),
      });
      assert(saved.status === 'private', `${item.id} did not save as a private My Sounds item.`);
      assert(saved.publishedVersionId, `${item.id} save did not freeze a recipe version.`);
      assert(saved.renderStatus === 'ready', `${item.id} save lost ready render status.`);
      assert(saved.renderedAudioUrl === created.mix.renderedAudioUrl, `${item.id} save lost composer rendered URL.`);
      assert(saved.recipeData?.versionState === 'frozen', `${item.id} saved recipe is not frozen.`);
      assert(saved.recipeData?.quickCreate?.composerRenderPilot?.proofId === item.expectedProofId, `${item.id} saved recipe lost composer proof metadata.`);

      const replay = await request<Json>(`/api/mixes/${mixId}`);
      assert(replay.mix?.status === 'private', `${item.id} replay fetch lost private status.`);
      assert(replay.mix?.renderStatus === 'ready', `${item.id} replay fetch lost ready render status.`);
      assert(replay.mix?.renderedAudioUrl === created.mix.renderedAudioUrl, `${item.id} replay fetch lost composer rendered URL.`);
      assert((replay.tracks ?? []).length >= 2, `${item.id} replay fetch lost editable track metadata.`);

      savedReplayProof = {
        mixId,
        status: replay.mix.status,
        renderStatus: replay.mix.renderStatus,
        renderedAudioUrl: replay.mix.renderedAudioUrl,
        versionState: replay.mix.recipeData.versionState,
        proofId: replay.mix.recipeData.quickCreate.composerRenderPilot.proofId,
        trackCount: replay.tracks.length,
      };
    }

    results.push({
      id: item.id,
      goal: item.goal,
      scene: item.scene,
      quickCreateMs,
      mixId,
      proofId: pilot.proofId,
      composerMode: pilot.composerMode,
      renderedAudioUrl: created.mix.renderedAudioUrl,
      trackCount: created.mix.recipeData.tracks.length,
      editableTrackUrls: created.tracks.map((track: Json) => track.url),
      selectedAtomicElementIds: pilot.selectedAtomicElementIds,
      selectedSupportMaterialIds: pilot.selectedSupportMaterialIds,
      productionAllowed: false,
    });
  }

  assert(savedReplayProof, 'No composer saved replay proof was produced.');
  const report = {
    schemaVersion: '1.0.0',
    regressionId,
    generatedAt: new Date().toISOString(),
    status: 'passed',
    apiBase: API_BASE,
    sourceProofManifest: 'public/audio/music/local-review/composer-result-render-proof-v1/manifest.json',
    productionAllowed: false,
    purpose: 'Verify a consumer sentence can enter the professionally rendered composer result chain and arrive at an immediately playable Player-ready mix.',
    counts: {
      cases: results.length,
      musicSupported: results.filter((item) => item.composerMode === 'music_supported').length,
      supportOnly: results.filter((item) => item.composerMode === 'support_only').length,
      readyRenderedMixes: results.filter((item) => String(item.renderedAudioUrl).includes('/composer-result-render-proof-v1/prepared/')).length,
      savedReplayProofs: savedReplayProof ? 1 : 0,
      productionAllowed: 0,
    },
    savedReplayProof,
    results,
  };

  await mkdir(path.join(root, 'reports'), { recursive: true });
  await writeFile(path.join(root, 'reports', `${regressionId}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, 'reports', `${regressionId}.md`), `# Composer Quick Create Consumer Chain V1

Generated: ${report.generatedAt}

Status: \`${report.status}\`

## Verdict

Consumer Quick Create now reaches the professionally rendered composer proof
chain. The six verified composer outputs are returned as immediately playable
Player-ready mixes, while editable Recipe V2 source metadata remains separate
from the final proof MP3.

## Counts

| Metric | Count |
| --- | ---: |
| Cases | ${report.counts.cases} |
| Music-supported | ${report.counts.musicSupported} |
| Support-only | ${report.counts.supportOnly} |
| Ready rendered mixes | ${report.counts.readyRenderedMixes} |
| Saved replay proofs | ${report.counts.savedReplayProofs} |
| Production allowed | ${report.counts.productionAllowed} |

## Boundary

These are controlled composer pilot results, not public production release
content. The route does not ask the user to choose materials.

## Cases

${results.map((item) => `- \`${item.id}\`: proof=${item.proofId}, mode=${item.composerMode}, render=${item.renderedAudioUrl}`).join('\n')}
`);

  console.log(JSON.stringify({
    passed: true,
    regressionId,
    counts: report.counts,
    productionAllowed: report.productionAllowed,
    reportPath: `reports/${regressionId}.md`,
    jsonReportPath: `reports/${regressionId}.json`,
  }, null, 2));
} finally {
  for (const mixId of mixIds.filter(Boolean)) {
    await query('delete from playback_events where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from user_history where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from mix_recipe_versions where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from mixes where id = $1', [mixId]).catch(() => undefined);
  }
  if (userId) await query('delete from users where id = $1', [userId]).catch(() => undefined);
  await pool.end();
}
