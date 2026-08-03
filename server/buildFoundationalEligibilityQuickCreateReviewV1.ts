import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Json = Record<string, any>;

const root = process.cwd();
const batchId = 'foundational-eligibility-quick-create-review-v1';
const apiBase = process.env.API_BASE ?? 'http://127.0.0.1:8788';
const outputAudioDir = path.join(root, 'public/audio/music/local-review', batchId, 'prepared');
const reviewDir = path.join(root, 'public/review', batchId);
const manifestPath = path.join(reviewDir, 'manifest.json');
const reviewPath = path.join(reviewDir, 'index.html');
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);

let token = '';

const request = async (pathname: string, init: RequestInit = {}) => {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  }
  return body as Json;
};

const escapeHtml = (value: unknown) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const cases = [
  {
    id: 'sleep_sparse_piano',
    goal: 'sleep',
    scene: 'bedtime',
    prompt: '睡前需要温暖、稀疏的钢琴音乐感，没有人声和鼓点。',
    reviewQuestion: '是否舒缓、稀疏、没有鼓点，且不像固定成品曲？',
  },
  {
    id: 'calm_air_texture',
    goal: 'calm',
    scene: 'breathing',
    prompt: '十分钟冥想，只要舒缓空间感和空气纹理，不要音乐、不要人声、不要鼓点。',
    reviewQuestion: '是否像冥想空间感而不是道路/机器噪声？',
  },
  {
    id: 'focus_low_distraction',
    goal: 'focus',
    scene: 'deep_focus',
    prompt: '白天深度工作，需要低干扰的环境层和一点柔和支撑，不要人声，不要强节奏。',
    reviewQuestion: '是否低干扰、有支撑但不抢注意力？',
  },
] as const;

await mkdir(outputAudioDir, { recursive: true });
await mkdir(reviewDir, { recursive: true });
await mkdir(path.join(root, 'reports'), { recursive: true });

const guest = await request('/api/auth/guest', { method: 'POST' });
token = String(guest.token ?? '');
if (!token) throw new Error('guest authentication failed');

const results: Json[] = [];

try {
  for (const item of cases) {
    const created = await request('/api/quick-create', {
      method: 'POST',
      body: JSON.stringify({
        prompt: item.prompt,
        goal: item.goal,
        scene: item.scene,
        durationSeconds: 300,
        guidedVoice: false,
      }),
    });
    const plan = created.planning?.elementCompositionPlan;
    if (plan?.source !== 'foundational_recipe_eligibility_map_v1') {
      throw new Error(`${item.id} did not use foundational_recipe_eligibility_map_v1`);
    }
    const rendered = await request(`/api/mixes/${created.mix.id}/render`, { method: 'POST', body: '{}' });
    const renderedUrl = String(rendered.renderedAudioUrl ?? '');
    if (!renderedUrl) throw new Error(`${item.id} render did not return renderedAudioUrl`);
    const audioResponse = await fetch(`${apiBase}${renderedUrl}`);
    if (!audioResponse.ok) throw new Error(`${item.id} rendered audio fetch failed: ${audioResponse.status}`);
    const audioBytes = Buffer.from(await audioResponse.arrayBuffer());
    if (audioBytes.length < 100_000) throw new Error(`${item.id} rendered audio too small`);
    const localFile = `${item.id}.mp3`;
    await writeFile(path.join(outputAudioDir, localFile), audioBytes);
    const preparedAudioUrl = `/audio/music/local-review/${batchId}/prepared/${localFile}`;
    results.push({
      ...item,
      mixId: created.mix.id,
      title: created.mix.title,
      contentMode: created.mix.recipeData.contentMode,
      recipeId: created.mix.recipeData.quickCreate?.recipeId,
      preparedAudioUrl,
      copiedBytes: audioBytes.length,
      renderQa: rendered.qaReport,
      selected: plan.selected,
      selectedSymbolicRuleIds: plan.selectedSymbolicRuleIds,
      tracks: created.mix.recipeData.tracks.map((track: Json) => ({
        stemId: track.stemId,
        role: track.role,
        volume: track.volume,
        sourceDuration: track.sourceDuration,
        loop: track.loop,
      })),
      runtimeExternalApiUsed: plan.runtimeExternalApiUsed,
      productionAllowed: false,
    });
  }
} finally {
  await fetch(`${apiBase}/api/me`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}`, 'x-confirm-account-deletion': 'DELETE' },
  }).catch(() => undefined);
}

const manifest = {
  schemaVersion: '1.0.0',
  batchId,
  generatedAt: new Date().toISOString(),
  status: 'rendered_quick_create_review_ready',
  routeFlag: 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1',
  sourceMap: 'config/foundational-recipe-eligibility-map-v1.json',
  productionAllowed: false,
  formalUsablePromotionAllowed: false,
  purpose: 'Rendered listening proof for Quick Create results generated from Foundational Recipe Eligibility Map V1.',
  hardRules: [
    'These rendered review outputs are proof results, not foundational elements.',
    'They must not be counted as new materials or production release assets.',
    'No runtime full-track generation API may be used.',
    'Voice, choir, singing, chanting, human-like vocal texture, and medical/healing claims remain blocked.',
  ],
  counts: {
    cases: results.length,
    rendered: results.filter((item) => item.preparedAudioUrl).length,
    distinctSelections: new Set(results.map((item) => item.selected.map((entry: Json) => entry.eligibilityId).sort().join('|'))).size,
    runtimeExternalApiUsed: results.filter((item) => item.runtimeExternalApiUsed).length,
  },
  results,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(reportJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);

const cards = results.map((item) => `
      <article class="card">
        <p class="eyebrow">${escapeHtml(item.goal)} · ${escapeHtml(item.scene)} · ${escapeHtml(item.contentMode)}</p>
        <h2>${escapeHtml(item.id)}</h2>
        <p class="prompt">${escapeHtml(item.prompt)}</p>
        <audio controls preload="metadata" src="../../${escapeHtml(String(item.preparedAudioUrl).replace(/^\//, ''))}"></audio>
        <p><strong>审核问题：</strong>${escapeHtml(item.reviewQuestion)}</p>
        <details>
          <summary>Selected foundational elements</summary>
          <pre>${escapeHtml(JSON.stringify(item.selected, null, 2))}</pre>
        </details>
        <details>
          <summary>Recipe tracks</summary>
          <pre>${escapeHtml(JSON.stringify(item.tracks, null, 2))}</pre>
        </details>
        <label>Decision
          <select data-key="${escapeHtml(item.id)}:decision">
            <option value="">pending</option>
            <option value="pass">pass</option>
            <option value="needs_adjustment">needs adjustment</option>
            <option value="reject">reject</option>
          </select>
        </label>
        <label>Notes
          <textarea data-key="${escapeHtml(item.id)}:notes" rows="3" placeholder="舒缓度、道路感、鼓点感、刺耳、听腻风险、是否符合目标..."></textarea>
        </label>
      </article>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Eligibility Quick Create Review V1</title>
  <style>
    body{margin:0;background:#101210;color:#eef4ed;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1120px;margin:0 auto;padding:30px 16px 80px}
    .hero,.card{border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:18px;background:rgba(255,255,255,.045);margin:14px 0}
    .hero{background:linear-gradient(135deg,rgba(139,117,72,.22),rgba(72,99,90,.16))}
    .eyebrow{color:#dec987;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800}
    .prompt{color:#d9e4d6}
    audio{width:100%;margin:10px 0}
    pre{white-space:pre-wrap;max-height:260px;overflow:auto;background:rgba(0,0,0,.2);padding:10px;border-radius:12px}
    label{display:grid;gap:5px;margin-top:10px;color:#c8d3c4;font-size:13px}
    select,textarea{background:#151915;color:#eef4ed;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:9px;font:inherit}
    button{border:0;border-radius:12px;background:#dec987;color:#171811;padding:11px 15px;font-weight:800;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">MixStil · rendered quick create proof</p>
      <h1>Foundational Eligibility Quick Create Review V1</h1>
      <p>这页是新路由的真实 Quick Create 渲染试听：用户一句话 -> eligibility map 选基础元素 -> Recipe V2 -> 完整混音 MP3。</p>
      <p>这些是 proof renders，不是新基础素材，也不是 production release。</p>
      <button id="export">导出试听决策</button>
    </section>
    ${cards}
  </main>
  <script>
    const key='snooze-${batchId}';
    const state=JSON.parse(localStorage.getItem(key)||'{}');
    document.querySelectorAll('[data-key]').forEach(input=>{
      input.value=state[input.dataset.key]||'';
      const save=()=>{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state));};
      input.addEventListener('change',save);
      input.addEventListener('input',save);
    });
    document.getElementById('export').addEventListener('click',()=>{
      const payload={schemaVersion:'1.0.0',batchId:'${batchId}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      const a=document.createElement('a'); a.href=url; a.download='${batchId}-review.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),0);
    });
  </script>
</body>
</html>`;

await writeFile(reviewPath, html);

const report = `# Foundational Eligibility Quick Create Review V1

Generated: ${manifest.generatedAt}

Status: \`${manifest.status}\`

## Counts

| Metric | Count |
| --- | ---: |
| Cases | ${manifest.counts.cases} |
| Rendered | ${manifest.counts.rendered} |
| Distinct selections | ${manifest.counts.distinctSelections} |
| Runtime external API used | ${manifest.counts.runtimeExternalApiUsed} |

## Review

Open: \`/review/${batchId}/index.html\`

## Boundary

These are rendered proof outputs, not new foundational materials and not production release assets.
`;

await writeFile(reportPath, report);

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  reviewUrl: `/review/${batchId}/index.html`,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
