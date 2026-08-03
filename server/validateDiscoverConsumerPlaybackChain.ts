const API_BASE = process.env.SNOOZE_API_BASE ?? 'http://localhost:8788';

const requiredPlacements = {
  'sleep-ready': [
    'mix_demand_plus_variants_2026_07_30_sleep_ready_01',
    'mix_demand_plus_variants_2026_07_30_sleep_ready_02',
    'mix_demand_plus_variants_2026_07_30_sleep_ready_03',
  ],
  focus: [
    'mix_demand_plus_variants_2026_07_30_focus_01',
    'mix_demand_plus_variants_2026_07_30_focus_02',
    'mix_demand_plus_variants_2026_07_30_focus_03',
  ],
};

const fail = (message: string): never => {
  throw new Error(`Discover consumer playback chain validation failed: ${message}`);
};

const getJson = async (path: string) => {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) fail(`${path} returned ${response.status}`);
  return response.json();
};

const discover = await getJson('/api/discover');
const sections = Array.isArray(discover.sections) ? discover.sections : [];

for (const [sectionId, mixIds] of Object.entries(requiredPlacements)) {
  const section = sections.find((item: any) => item.id === sectionId);
  if (!section) fail(`missing Discover section ${sectionId}`);
  const returnedIds = new Set((section.mixes ?? []).map((mix: any) => mix.id));
  for (const mixId of mixIds) {
    if (!returnedIds.has(mixId)) fail(`${sectionId} does not return ${mixId}`);
  }
}

const checkedMixes: Array<{ mixId: string; renderedAudioUrl: string; trackCount: number }> = [];
for (const mixId of Object.values(requiredPlacements).flat()) {
  const detail = await getJson(`/api/mixes/${encodeURIComponent(mixId)}`);
  const mix = detail.mix;
  if (!mix) fail(`${mixId} detail response missing mix`);
  if (mix.status !== 'published') fail(`${mixId} is not published`);
  if (mix.renderStatus !== 'ready') fail(`${mixId} render status is ${mix.renderStatus}`);
  if (!mix.publishedVersionId) fail(`${mixId} missing frozen published version`);
  if (!mix.renderedAudioUrl) fail(`${mixId} missing rendered audio URL`);
  if (!Array.isArray(detail.tracks) || detail.tracks.length === 0) fail(`${mixId} has no playable tracks`);
  checkedMixes.push({ mixId, renderedAudioUrl: mix.renderedAudioUrl, trackCount: detail.tracks.length });
}

console.log(JSON.stringify({
  passed: true,
  apiBase: API_BASE,
  sections: Object.keys(requiredPlacements),
  checkedMixes,
  gates: [
    'discover_sections_return_released_demand_variants',
    'player_mix_detail_has_rendered_audio',
    'player_mix_detail_has_playable_tracks',
    'published_frozen_content_only',
  ],
}, null, 2));
