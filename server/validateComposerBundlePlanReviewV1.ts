import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Manifest = {
  batchId: string;
  status: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  hardRules: string[];
  counts: {
    cases: number;
    musicSupported: number;
    supportOnly: number;
    passedStaticExpectations: number;
    runtimeExternalApiUsed: number;
    professionalPass: number;
    professionalAdjustmentRequired: number;
  };
  results: Array<{
    id: string;
    expectedMode: 'music_supported' | 'support_only';
    passedStaticExpectation: boolean;
    bundle: {
      version: string;
      mode: 'music_supported' | 'support_only';
      bundle: {
        instrumentSource: unknown | null;
        compositionPlan: unknown | null;
        harmony: unknown | null;
        motif: unknown | null;
        padDrone: string | null;
        environmentBed: string;
        organicTexture: string;
        accentOneShot: string | null;
        deterministicAcousticConfig: string;
      };
      selectedMaterials: Array<{ role: string; id: string; reason: string }>;
      exclusionsApplied: string[];
      intentionallyExcluded: string[];
      runtimeExternalApiUsed: boolean;
    };
    professionalReview: {
      decision: 'professional_pass' | 'professional_adjustment_required';
      producerSummary: string;
      notes: string[];
      risksAvoided: string[];
      risksRemaining: string[];
    };
  }>;
  reviewUrl: string;
};

const root = process.cwd();
const batchId = 'composer-bundle-plan-v1';
const manifestPath = path.join(root, 'public/review', batchId, 'manifest.json');
const htmlPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => {
  throw new Error(`Composer bundle plan review validation failed: ${message}`);
};

if (!existsSync(manifestPath)) fail('manifest missing');
if (!existsSync(htmlPath)) fail('review page missing');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const html = readFileSync(htmlPath, 'utf8');

if (manifest.batchId !== batchId) fail('batch id changed');
if (manifest.status !== 'composer_bundle_plan_review_ready') fail(`unexpected status ${manifest.status}`);
if (manifest.productionAllowed !== false || manifest.publicReleaseAllowed !== false) fail('production/public release must remain blocked');
if (manifest.reviewUrl !== `/review/${batchId}/index.html`) fail('review URL mismatch');
if (manifest.counts.cases !== 6 || manifest.results.length !== 6) fail('expected 6 bundle plan cases');
if (manifest.counts.musicSupported !== 3 || manifest.counts.supportOnly !== 3) fail('expected 3 music-supported and 3 support-only cases');
if (manifest.counts.passedStaticExpectations !== manifest.counts.cases) fail('not all static expectations passed');
if (manifest.counts.runtimeExternalApiUsed !== 0) fail('runtime external API must not be used');
if ((html.match(/<article/g) ?? []).length !== 6) fail('review page must show 6 cards');
if (!html.includes('用户一句话如何被拆成基础素材调用计划')) fail('review page missing product framing');
if (!html.includes('不是试听成品音乐')) fail('review page must not frame this as finished music review');
if (!html.includes('support_only')) fail('review page must expose support-only mode');
if (!html.includes('music_supported')) fail('review page must expose music-supported mode');
if (!html.includes('专业制作人判定')) fail('review page must show professional producer verdict');
if (!html.includes('不再要求用户做素材选择')) fail('review page must stop asking the user to choose materials');
if (/<input|<select|<textarea|导出 bundle plan 审查决策/i.test(html)) fail('review page must not contain owner decision controls');

const rulesText = manifest.hardRules.join(' ');
for (const required of ['Generic Sleep/Calm/Focus', 'Support-only requests', 'No medical']) {
  if (!rulesText.includes(required)) fail(`hard rule missing ${required}`);
}

for (const result of manifest.results) {
  const bundle = result.bundle;
  if (bundle.version !== 'composer_bundle_plan_v1') fail(`${result.id}: bundle version changed`);
  if (bundle.mode !== result.expectedMode || result.passedStaticExpectation !== true) fail(`${result.id}: mode expectation failed`);
  if (bundle.runtimeExternalApiUsed !== false) fail(`${result.id}: external API used`);
  if (!result.professionalReview?.producerSummary) fail(`${result.id}: missing professional review summary`);
  if (result.professionalReview.decision !== 'professional_pass') fail(`${result.id}: professional review did not pass`);
  if (result.professionalReview.notes.length < 2) fail(`${result.id}: professional review is too thin`);
  if (bundle.selectedMaterials.length < 4) fail(`${result.id}: selected material explanations missing`);
  for (const material of bundle.selectedMaterials) {
    if (!material.reason) fail(`${result.id}: material ${material.id} missing reason`);
  }
  if (bundle.mode === 'support_only') {
    if (bundle.bundle.instrumentSource || bundle.bundle.compositionPlan || bundle.bundle.harmony || bundle.bundle.motif || bundle.bundle.padDrone) {
      fail(`${result.id}: support-only bundle selected music materials`);
    }
    for (const required of ['instrument_source', 'composition_plan', 'harmony_template', 'motif', 'pad_drone']) {
      if (!bundle.intentionallyExcluded.includes(required)) fail(`${result.id}: support-only intentionallyExcluded missing ${required}`);
    }
  }
  if (bundle.mode === 'music_supported' && bundle.bundle.compositionPlan) {
    const composition = bundle.bundle.compositionPlan as { harmonyId?: string; motifId?: string };
    const harmony = bundle.bundle.harmony as { id?: string } | null;
    const motif = bundle.bundle.motif as { id?: string } | null;
    if (harmony?.id !== composition.harmonyId) fail(`${result.id}: harmony is not locked to composition plan`);
    if (motif?.id !== composition.motifId) fail(`${result.id}: motif is not locked to composition plan`);
  }
}

const noWaterNoRoad = manifest.results.find((item) => item.id === 'sleep_support_only_no_water_no_road');
if (!noWaterNoRoad) fail('missing no-water/no-road case');
const noWaterSelected = JSON.stringify(noWaterNoRoad.bundle.bundle);
for (const forbidden of ['distant_ocean_wash', 'gentle_rain_canopy', 'steady_room_ventilation', 'open_fifth_harmonic_bed']) {
  if (noWaterSelected.includes(forbidden)) fail(`no-water/no-road selected forbidden ${forbidden}`);
}

const focusNoNature = manifest.results.find((item) => item.id === 'focus_rhodes_no_nature');
if (!focusNoNature) fail('missing focus no-nature case');
const focusSelected = JSON.stringify(focusNoNature.bundle.bundle);
for (const forbidden of ['distant_ocean_wash', 'gentle_rain_canopy', 'night_forest_hush', 'quiet_fireplace_embers', 'soft_pine_wind', 'steady_room_ventilation']) {
  if (focusSelected.includes(forbidden)) fail(`focus no-nature selected forbidden ${forbidden}`);
}

const sleepPiano = manifest.results.find((item) => item.id === 'sleep_piano_warm_sparse');
if (!sleepPiano) fail('missing sleep piano case');
const sleepPianoInstrument = sleepPiano.bundle.bundle.instrumentSource as { instrumentType?: string } | null;
if (sleepPianoInstrument?.instrumentType !== 'piano') fail(`sleep piano selected ${sleepPianoInstrument?.instrumentType}`);

const focusMasking = manifest.results.find((item) => item.id === 'focus_masking_no_melody');
if (!focusMasking) fail('missing focus masking/no melody case');
if (focusMasking.bundle.bundle.environmentBed !== 'env_procedural_soft_airflow_bed_v1') {
  fail(`focus masking/no melody should use procedural airflow, received ${focusMasking.bundle.bundle.environmentBed}`);
}

console.log(JSON.stringify({
  passed: true,
  batchId,
  cases: manifest.counts.cases,
  musicSupported: manifest.counts.musicSupported,
  supportOnly: manifest.counts.supportOnly,
  reviewUrl: manifest.reviewUrl,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
