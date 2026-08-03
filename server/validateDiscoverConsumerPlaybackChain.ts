const API_BASE = process.env.SNOOZE_API_BASE ?? 'http://localhost:8788';

const requiredPlacements = {
  'sleep-ready': [
    'mix_finished_sleep_018_saveable_soft_descent',
    'mix_finished_sleep_019_soft_descent_deeper',
    'mix_finished_sleep_025_anxious_bedtime_soften',
  ],
  focus: [
    'mix_finished_focus_017_saveable_low_workbed',
    'mix_finished_focus_020_reading_low_light',
    'mix_finished_focus_021_deep_work_stable',
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
  const audioUrl = new URL(mix.renderedAudioUrl, API_BASE).toString();
  const audioResponse = await fetch(audioUrl, { headers: { Range: 'bytes=0-1023' } });
  if (audioResponse.status !== 200 && audioResponse.status !== 206) {
    fail(`${mixId} rendered audio returned ${audioResponse.status}`);
  }
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
    'rendered_audio_range_request_succeeds',
    'player_mix_detail_has_playable_tracks',
    'published_frozen_content_only',
  ],
}, null, 2));
