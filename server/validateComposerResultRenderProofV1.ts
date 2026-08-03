import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type RenderProof = {
  id: string;
  composerMode: 'music_supported' | 'support_only';
  selectedAtomicElementIds: string[];
  selectedSupportMaterialIds: string[];
  preparedAudioUrl: string;
  reviewAudioSrc: string;
  durationSeconds: number;
  machineStatus: 'pass' | 'review_required' | string;
  professionalVerdict: 'render_proof_pass' | 'render_proof_needs_adjustment';
  selectedBundle: {
    instrumentSource: { instrumentType?: string } | null;
    compositionPlan: { id?: string; harmonyId?: string; motifId?: string } | null;
    harmony: { id?: string } | null;
    motif: { id?: string } | null;
    padDrone: string | null;
    environmentBed: string;
    organicTexture: string;
    accentOneShot: string | null;
    deterministicAcousticConfig: string;
  };
};

type Manifest = {
  batchId: string;
  status: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  sourceComposerPlan: string;
  hardRules: string[];
  counts: {
    renders: number;
    musicSupported: number;
    supportOnly: number;
    machinePass: number;
    professionalRenderPass: number;
  };
  reviewUrl: string;
  renders: RenderProof[];
};

const root = process.cwd();
const batchId = 'composer-result-render-proof-v1';
const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => {
  throw new Error(`Composer result render proof validation failed: ${message}`);
};

if (!existsSync(manifestPath)) fail('manifest missing');
if (!existsSync(reviewPath)) fail('review page missing');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const html = readFileSync(reviewPath, 'utf8');

if (manifest.batchId !== batchId) fail('batch id changed');
if (manifest.status !== 'composer_result_render_proof_ready') fail(`unexpected status ${manifest.status}`);
if (manifest.productionAllowed || manifest.publicReleaseAllowed) fail('proof renders must not be production/public release');
if (manifest.sourceComposerPlan !== 'public/review/composer-bundle-plan-v1/manifest.json') fail('composer plan source mismatch');
if (manifest.reviewUrl !== `/review/${batchId}/index.html`) fail('review URL mismatch');
if (manifest.counts.renders !== 6 || manifest.renders.length !== 6) fail('expected six rendered proof mixes');
if (manifest.counts.musicSupported !== 3 || manifest.counts.supportOnly !== 3) fail('expected 3 music-supported and 3 support-only renders');
if (manifest.counts.professionalRenderPass !== 6) fail('all proof renders must pass professional render verdict');
if ((html.match(/<audio /g) ?? []).length !== 6) fail('review page must expose six audio controls');
if (/<input|<select|<textarea/i.test(html)) fail('review page must not ask owner to choose materials');
if (!html.includes('不让用户选素材')) fail('review page missing professional ownership framing');

const rules = manifest.hardRules.join(' ');
for (const required of ['not foundational elements', 'Owner does not choose materials', 'Support-only requests']) {
  if (!rules.includes(required)) fail(`hard rule missing ${required}`);
}

for (const item of manifest.renders) {
  const audioPath = path.join(root, 'public', item.preparedAudioUrl.replace(/^\//, ''));
  if (!existsSync(audioPath)) fail(`${item.id}: rendered audio missing`);
  if (statSync(audioPath).size < 100_000) fail(`${item.id}: rendered audio too small`);
  if (!item.reviewAudioSrc.includes(item.preparedAudioUrl.replace(/^\//, ''))) fail(`${item.id}: review audio src mismatch`);
  if (item.durationSeconds < 59 || item.durationSeconds > 61) fail(`${item.id}: unexpected duration ${item.durationSeconds}`);
  if (item.machineStatus !== 'pass') fail(`${item.id}: machine status ${item.machineStatus}`);
  if (item.professionalVerdict !== 'render_proof_pass') fail(`${item.id}: professional verdict ${item.professionalVerdict}`);
  if (item.selectedSupportMaterialIds.length < 2) fail(`${item.id}: missing support materials`);

  if (item.composerMode === 'support_only') {
    if (item.selectedAtomicElementIds.length !== 0) fail(`${item.id}: support-only render used atomic music elements`);
    if (item.selectedBundle.instrumentSource || item.selectedBundle.compositionPlan || item.selectedBundle.harmony || item.selectedBundle.motif || item.selectedBundle.padDrone) {
      fail(`${item.id}: support-only selected music bundle material`);
    }
  } else {
    if (item.selectedAtomicElementIds.length < 3) fail(`${item.id}: music-supported render selected too few atomic elements`);
    if (!item.selectedBundle.instrumentSource || !item.selectedBundle.compositionPlan || !item.selectedBundle.harmony || !item.selectedBundle.motif) {
      fail(`${item.id}: music-supported render missing music bundle material`);
    }
    if (item.selectedBundle.harmony.id !== item.selectedBundle.compositionPlan.harmonyId) fail(`${item.id}: harmony not locked to composition`);
    if (item.selectedBundle.motif.id !== item.selectedBundle.compositionPlan.motifId) fail(`${item.id}: motif not locked to composition`);
  }
}

const sleepPiano = manifest.renders.find((item) => item.id === 'sleep_piano_warm_sparse');
if (!sleepPiano) fail('missing sleep piano render');
if (sleepPiano.selectedBundle.instrumentSource?.instrumentType !== 'piano') fail('sleep piano render did not use piano source');

const focusMasking = manifest.renders.find((item) => item.id === 'focus_masking_no_melody');
if (!focusMasking) fail('missing focus masking render');
if (focusMasking.selectedAtomicElementIds.length !== 0) fail('focus masking/no melody render used music atoms');
if (!focusMasking.selectedSupportMaterialIds.includes('proc_velvet_room_air_a')) fail('focus masking should use low-identity room air');

console.log(JSON.stringify({
  passed: true,
  batchId,
  renders: manifest.counts.renders,
  musicSupported: manifest.counts.musicSupported,
  supportOnly: manifest.counts.supportOnly,
  reviewUrl: manifest.reviewUrl,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
