import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CatalogRecipe, CatalogTrack, ContentMode, ProductGoal, ProductScene } from './contentCatalog';
import type { FoundationalCompositionBundle } from './foundationalCompositionRouterV1';

type ComposerRenderProof = {
  id: string;
  label: string;
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  composerMode: 'music_supported' | 'support_only';
  professionalReviewDecision: string;
  selectedAtomicElementIds: string[];
  selectedSupportMaterialIds: string[];
  preparedAudioUrl: string;
  durationSeconds: number;
  machineStatus: string;
  professionalVerdict: string;
  selectedBundle: FoundationalCompositionBundle['bundle'];
};

type ComposerRenderManifest = {
  batchId: 'composer-result-render-proof-v1';
  status: 'composer_result_render_proof_ready';
  productionAllowed: false;
  publicReleaseAllowed: false;
  counts: {
    renders: number;
    musicSupported: number;
    supportOnly: number;
    machinePass: number;
    professionalRenderPass: number;
  };
  renders: ComposerRenderProof[];
};

export type ComposerResultRenderPilot = {
  source: 'composer_result_render_proof_v1';
  proofId: string;
  proofAudioUrl: string;
  composerMode: ComposerRenderProof['composerMode'];
  professionalVerdict: string;
  selectedAtomicElementIds: string[];
  selectedSupportMaterialIds: string[];
  recipe: CatalogRecipe;
  planningSelected: Array<{ stemId: string; role: CatalogTrack['role']; reason: string }>;
};

const root = process.cwd();
const manifestPath = path.join(root, 'public/audio/music/local-review/composer-result-render-proof-v1/manifest.json');

const readManifest = (): ComposerRenderManifest | null => {
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ComposerRenderManifest;
  if (
    manifest.batchId !== 'composer-result-render-proof-v1'
    || manifest.status !== 'composer_result_render_proof_ready'
    || manifest.productionAllowed !== false
    || manifest.publicReleaseAllowed !== false
    || manifest.counts.renders !== 6
    || manifest.counts.machinePass !== 6
    || manifest.counts.professionalRenderPass !== 6
  ) return null;
  return manifest;
};

const includesAny = (source: string, terms: string[]) => terms.some((term) => source.includes(term));

const chooseProofId = (input: {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  composerMode: ComposerRenderProof['composerMode'];
}) => {
  const lower = input.prompt.toLowerCase();
  if (input.composerMode === 'support_only') {
    if (input.goal === 'calm' && includesAny(lower, ['528', 'frequency', '频率'])) return 'calm_528_support_only';
    if (input.goal === 'focus' && includesAny(lower, ['mask', 'masking', '遮蔽', 'no melody', '不要旋律', '外界干扰'])) return 'focus_masking_no_melody';
    if (input.goal === 'sleep' && includesAny(lower, ['no water', '不要水', '不要水声', 'no road', '不要公路', '不要公路感', '柔和遮蔽'])) {
      return 'sleep_support_only_no_water_no_road';
    }
    return null;
  }
  if (input.goal === 'sleep' && includesAny(lower, ['piano', '钢琴', 'warm piano', '柔和钢琴', '钢琴感'])) return 'sleep_piano_warm_sparse';
  if (input.goal === 'calm' && includesAny(lower, ['guitar', '吉他'])) return 'calm_guitar_meditation';
  if (input.goal === 'focus' && includesAny(lower, ['rhodes', 'electric piano', '电钢琴'])) return 'focus_rhodes_no_nature';
  return null;
};

const stemIdFor = (sourceId: string) => sourceId.startsWith('atom_')
  ? `stem_atomic_${sourceId}`
  : `stem_foundation_${sourceId}`;

const roleForSupport = (sourceId: string): CatalogTrack['role'] => {
  if (/bowl|tail|accent/i.test(sourceId)) return 'accent';
  if (/room|air|pine|ocean|environment/i.test(sourceId)) return 'environment';
  return 'base';
};

const track = (
  stemId: string,
  role: CatalogTrack['role'],
  volume: number,
  duration: number,
  startTime = 0,
  sourceDuration = 60,
): CatalogTrack => ({
  stemId,
  role,
  volume,
  startTime,
  duration,
  trimStart: 0,
  trimEnd: sourceDuration,
  isMuted: false,
  fade: { inSeconds: role === 'accent' ? 0.1 : 3, outSeconds: role === 'accent' ? 2 : 6 },
  loop: { enabled: role !== 'accent', crossfadeSeconds: role === 'accent' ? 0 : 3 },
});

const buildTracks = (proof: ComposerRenderProof, durationSeconds: number): CatalogTrack[] => {
  const supportTracks = proof.selectedSupportMaterialIds.map((id, index) => {
    const role = roleForSupport(id);
    const volume = role === 'accent' ? 5 : index === 0 ? 36 : 26;
    const startTime = role === 'accent' ? Math.min(52, Math.max(20, Math.round(durationSeconds * 0.82))) : 0;
    return track(stemIdFor(id), role, volume, role === 'accent' ? 8 : durationSeconds, startTime, proof.durationSeconds);
  });
  const atomicTracks = proof.selectedAtomicElementIds.map((id, index) => (
    track(stemIdFor(id), 'music', index === 0 ? 30 : index === 1 ? 18 : 14, durationSeconds, 0, proof.durationSeconds)
  ));
  return [...supportTracks, ...atomicTracks];
};

const contentModeFor = (mode: ComposerRenderProof['composerMode']): Exclude<ContentMode, 'guided_meditation'> =>
  mode === 'support_only' ? 'pure_soundscape' : 'functional_music';

export const selectComposerResultRenderPilot = (input: {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  durationSeconds: number;
  composerBundlePlan: FoundationalCompositionBundle | null;
}): ComposerResultRenderPilot | null => {
  if (!input.composerBundlePlan) return null;
  const manifest = readManifest();
  if (!manifest) return null;
  const composerMode = input.composerBundlePlan.mode;
  const proofId = chooseProofId({ ...input, composerMode });
  if (!proofId) return null;
  const proof = manifest.renders.find((item) => item.id === proofId)
    ?? null;
  if (!proof || proof.machineStatus !== 'pass' || proof.professionalVerdict !== 'render_proof_pass') return null;
  if (proof.composerMode === 'support_only' && proof.selectedAtomicElementIds.length > 0) return null;

  const durationSeconds = Math.max(300, Math.min(7200, Math.round(input.durationSeconds)));
  const tracks = buildTracks(proof, durationSeconds);
  const modeLabel = proof.composerMode === 'support_only' ? 'Support Only' : 'Composer Music';
  const recipe: CatalogRecipe = {
    id: `composer-result-render-${input.goal}-${proof.composerMode}`,
    name: `${input.goal === 'sleep' ? 'Sleep' : input.goal === 'calm' ? 'Calm' : 'Focus'} Composer Result`,
    goal: input.goal,
    scene: input.scene,
    durationSeconds,
    tracks,
    moodTags: [input.goal, modeLabel, 'Composer Result Render Proof V1'],
    contentMode: contentModeFor(proof.composerMode),
    mixProfile: {
      phaseBalance: {
        arrival: proof.composerMode === 'support_only' ? 'environment' : 'music',
        core: proof.composerMode === 'support_only' ? 'base' : 'music',
        release: proof.composerMode === 'support_only' ? 'environment' : 'music',
      },
    },
  };

  return {
    source: 'composer_result_render_proof_v1',
    proofId: proof.id,
    proofAudioUrl: proof.preparedAudioUrl,
    composerMode: proof.composerMode,
    professionalVerdict: proof.professionalVerdict,
    selectedAtomicElementIds: proof.selectedAtomicElementIds,
    selectedSupportMaterialIds: proof.selectedSupportMaterialIds,
    recipe,
    planningSelected: tracks.map((item) => ({
      stemId: item.stemId,
      role: item.role,
      reason: `Selected by professional composer render proof ${proof.id}.`,
    })),
  };
};
