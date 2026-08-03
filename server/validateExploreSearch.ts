const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

export {};

type Mix = {
  title: string;
  description: string;
  recipeData: { tracks: Array<{ stemId: string; volume: number; isMuted: boolean }> };
};
type Feed = {
  editorsChoice: Mix | null;
  trending: Mix[];
  search: { query: string; total: number; exactContentMatches: boolean };
};
type Stem = { id: string; name: string; tags: string[] };

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`);
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${body.error ?? 'unknown error'}`);
  return body as T;
};

const missingTerm = `missing-${Date.now()}-sound`;
const empty = await request<Feed>(`/api/discover?query=${encodeURIComponent(missingTerm)}`);
if (empty.editorsChoice !== null || empty.trending.length !== 0 || empty.search.total !== 0) {
  throw new Error('Explore search fell back to an unrelated result instead of returning an empty state.');
}

const [forest, hashRain, rain, stems] = await Promise.all([
  request<Feed>('/api/discover?query=forest'),
  request<Feed>('/api/discover?query=%23Rain'),
  request<Feed>('/api/discover?query=rain'),
  request<Stem[]>('/api/audio-stems'),
]);
if (forest.editorsChoice !== null || !forest.search.exactContentMatches || forest.search.total !== forest.trending.length) {
  throw new Error('Explore forest search did not return an explicit exact-content result set.');
}
if (hashRain.search.total !== rain.search.total) throw new Error('Explore hashtag normalization changed the result set.');

const stemsById = new Map(stems.map((stem) => [stem.id, stem]));
const matchesTerm = (mix: Mix, term: string) => {
  const textMatches = `${mix.title} ${mix.description}`.toLowerCase().includes(term);
  const stemMatches = mix.recipeData.tracks.some((track) => {
    if (track.isMuted || Number(track.volume) <= 0) return false;
    const stem = stemsById.get(track.stemId);
    return Boolean(stem && `${stem.name} ${stem.tags.join(' ')}`.toLowerCase().includes(term));
  });
  return textMatches || stemMatches;
};
if (forest.trending.some((mix) => !matchesTerm(mix, 'forest'))) {
  throw new Error('Explore forest search returned a mix without audible forest content.');
}
if (rain.search.total < 1 || rain.trending.some((mix) => !matchesTerm(mix, 'rain'))) {
  throw new Error('Explore rain search did not return only audible rain content.');
}

console.log(JSON.stringify({
  passed: true,
  forestResults: forest.search.total,
  rainResults: rain.search.total,
  emptyStateVerified: true,
  hashtagNormalizationVerified: true,
}, null, 2));
