import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Json = Record<string, any>;

const root = process.cwd();
const batchId = 'foundational-eligibility-coverage-render-v1';
const apiBase = process.env.API_BASE ?? 'http://127.0.0.1:8788';
const outputAudioDir = path.join(root, 'public/audio/music/local-review', batchId, 'prepared');
const reviewDir = path.join(root, 'public/review', batchId);
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);
const manifestPath = path.join(reviewDir, 'manifest.json');
const reviewPath = path.join(reviewDir, 'index.html');

let token = '';

const escapeHtml = (value: unknown) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

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
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body as Json;
};

const cases = [
  {
    id: 'sleep_bedtime_warm_sparse',
    goal: 'sleep',
    scene: 'bedtime',
    prompt: '睡前想要温暖、很慢、很稀疏的声音，有一点钢琴感，但不要人声、不要鼓点、不要明显旋律。',
  },
  {
    id: 'sleep_return_no_water',
    goal: 'sleep',
    scene: 'return_to_sleep',
    prompt: '半夜醒来回睡，需要低频包裹感和安静空气感，不要水声、不要人声、不要鼓点。',
  },
  {
    id: 'sleep_no_music_dark_hush',
    goal: 'sleep',
    scene: 'bedtime',
    prompt: '只要深一点的安静底层和柔和遮蔽，不要音乐、不要人声、不要鼓点、不要水声、不要公路感。',
  },
  {
    id: 'calm_breathing_space',
    goal: 'calm',
    scene: 'breathing',
    prompt: '十分钟呼吸冥想，需要宽一点的空间感和慢慢起伏的空气纹理，不要人声、不要鼓点。',
  },
  {
    id: 'calm_emotional_warm_pad',
    goal: 'calm',
    scene: 'emotional_settling',
    prompt: '情绪有点紧，需要温暖、舒缓、像软垫一样托住的声音，不要唱诵、不要鼓点。',
  },
  {
    id: 'calm_light_instrument_hint',
    goal: 'calm',
    scene: 'emotional_settling',
    prompt: '放松冥想，希望有一点点稀疏钢琴和轻音乐质感，但整体要很空、很慢、不能有强旋律和人声。',
  },
  {
    id: 'focus_low_distraction_haze',
    goal: 'focus',
    scene: 'deep_focus',
    prompt: '深度工作，需要低干扰、稳定、柔和支撑的声音，不要人声，不要明显鼓点。',
  },
  {
    id: 'focus_airy_clear_support',
    goal: 'focus',
    scene: 'deep_focus',
    prompt: '白天专注，希望更清透一点、有轻微明亮感，但不能刺激、不能像电子舞曲。',
  },
  {
    id: 'focus_no_melody_masking',
    goal: 'focus',
    scene: 'deep_focus',
    prompt: '写代码时需要遮蔽外界干扰，不要旋律、不要水声、不要人声、不要强节奏。',
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
    if (plan?.source !== 'foundational_recipe_eligibility_map_v1') throw new Error(`${item.id} did not use foundational_recipe_eligibility_map_v1`);
    const rendered = await request(`/api/mixes/${created.mix.id}/render`, { method: 'POST', body: '{}' });
    const renderedUrl = String(rendered.renderedAudioUrl ?? '');
    if (!renderedUrl) throw new Error(`${item.id} render did not return renderedAudioUrl`);
    const audioResponse = await fetch(`${apiBase}${renderedUrl}`);
    if (!audioResponse.ok) throw new Error(`${item.id} rendered audio fetch failed: ${audioResponse.status}`);
    const audioBytes = Buffer.from(await audioResponse.arrayBuffer());
    if (audioBytes.length < 100_000) throw new Error(`${item.id} rendered audio too small`);
    const localFile = `${item.id}.mp3`;
    await writeFile(path.join(outputAudioDir, localFile), audioBytes);
    results.push({
      ...item,
      mixId: created.mix.id,
      title: created.mix.title,
      contentMode: created.mix.recipeData.contentMode,
      recipeId: created.mix.recipeData.quickCreate?.recipeId,
      preparedAudioUrl: `/audio/music/local-review/${batchId}/prepared/${localFile}`,
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
  status: 'coverage_render_review_ready',
  routeFlag: 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1',
  sourceMap: 'config/foundational-recipe-eligibility-map-v1.json',
  productionAllowed: false,
  formalUsablePromotionAllowed: false,
  purpose: 'Nine rendered Quick Create coverage samples proving the foundational material pool can serve Sleep, Calm, and Focus user intents.',
  hardRules: [
    'Rendered coverage outputs are product-route proofs, not foundational elements.',
    'Do not count these renders as new materials or production release assets.',
    'No runtime full-track generation API may be used.',
    'Voice, choir, singing, chanting, human-like vocal texture, strong drums, and medical/healing claims remain blocked.',
  ],
  counts: {
    cases: results.length,
    rendered: results.filter((item) => item.preparedAudioUrl).length,
    sleep: results.filter((item) => item.goal === 'sleep').length,
    calm: results.filter((item) => item.goal === 'calm').length,
    focus: results.filter((item) => item.goal === 'focus').length,
    distinctSelections: new Set(results.map((item) => item.selected.map((entry: Json) => entry.eligibilityId).sort().join('|'))).size,
    runtimeExternalApiUsed: results.filter((item) => item.runtimeExternalApiUsed).length,
  },
  results,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(reportJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);

const cards = results.map((item, index) => `
      <article class="card">
        <p class="eyebrow">${index + 1}/9 · ${escapeHtml(item.goal)} · ${escapeHtml(item.scene)} · ${escapeHtml(item.contentMode)}</p>
        <h2>${escapeHtml(item.id)}</h2>
        <p class="prompt">${escapeHtml(item.prompt)}</p>
        <audio controls preload="metadata" src="../../${escapeHtml(String(item.preparedAudioUrl).replace(/^\//, ''))}"></audio>
        <div class="checks">
          <label><input type="checkbox" data-key="${escapeHtml(item.id)}:fit" /> 符合目标</label>
          <label><input type="checkbox" data-key="${escapeHtml(item.id)}:no_voice" /> 无人声/类人声</label>
          <label><input type="checkbox" data-key="${escapeHtml(item.id)}:no_drums" /> 无明显鼓点</label>
          <label><input type="checkbox" data-key="${escapeHtml(item.id)}:not_fixed_song" /> 不像固定成品曲</label>
          <label><input type="checkbox" data-key="${escapeHtml(item.id)}:not_road" /> 无公路/机器疲劳感</label>
        </div>
        <label>Decision
          <select data-key="${escapeHtml(item.id)}:decision">
            <option value="">pending</option>
            <option value="pass">pass</option>
            <option value="needs_adjustment">needs adjustment</option>
            <option value="reject">reject</option>
          </select>
        </label>
        <label>Notes
          <textarea data-key="${escapeHtml(item.id)}:notes" rows="3" placeholder="舒缓度、素材搭配、循环感、听腻风险、是否需要换元素..."></textarea>
        </label>
        <details><summary>Selected foundational elements</summary><pre>${escapeHtml(JSON.stringify(item.selected, null, 2))}</pre></details>
        <details><summary>Recipe tracks</summary><pre>${escapeHtml(JSON.stringify(item.tracks, null, 2))}</pre></details>
      </article>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Eligibility Coverage Render V1</title>
  <style>
    body{margin:0;background:#10120f;color:#edf4ec;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1160px;margin:0 auto;padding:30px 16px 90px}
    .hero,.card{border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:18px;background:rgba(255,255,255,.045);margin:14px 0}
    .hero{background:linear-gradient(135deg,rgba(108,132,92,.22),rgba(84,104,132,.16))}
    .eyebrow{color:#d8c884;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800}
    .prompt{color:#d9e4d6}
    audio{width:100%;margin:10px 0}
    .checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:12px 0}
    pre{white-space:pre-wrap;max-height:260px;overflow:auto;background:rgba(0,0,0,.2);padding:10px;border-radius:12px}
    label{display:grid;gap:5px;margin-top:10px;color:#c8d3c4;font-size:13px}
    .checks label{display:flex;align-items:center;gap:7px;margin:0}
    select,textarea{background:#151915;color:#eef4ed;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:9px;font:inherit}
    button{border:0;border-radius:12px;background:#d8c884;color:#171811;padding:11px 15px;font-weight:800;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">MixStil · nine-route coverage proof</p>
      <h1>Foundational Eligibility Coverage Render V1</h1>
      <p>这页验证“基础素材库 + eligibility map + Quick Create”是否能覆盖 Sleep / Calm / Focus 的真实用户话术。</p>
      <p>这些是产品路由渲染证明，不是新增基础元素，也不是生产发布资产。</p>
      <button id="export">导出覆盖试听决策</button>
    </section>
    ${cards}
  </main>
  <script>
    const key='snooze-${batchId}';
    const state=JSON.parse(localStorage.getItem(key)||'{}');
    document.querySelectorAll('[data-key]').forEach(input=>{
      if(input.type==='checkbox') input.checked=state[input.dataset.key]===true;
      else input.value=state[input.dataset.key]||'';
      const save=()=>{state[input.dataset.key]=input.type==='checkbox'?input.checked:input.value;localStorage.setItem(key,JSON.stringify(state));};
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

const report = `# Foundational Eligibility Coverage Render V1

Generated: ${manifest.generatedAt}

Status: \`${manifest.status}\`

## Counts

| Metric | Count |
| --- | ---: |
| Cases | ${manifest.counts.cases} |
| Rendered | ${manifest.counts.rendered} |
| Sleep | ${manifest.counts.sleep} |
| Calm | ${manifest.counts.calm} |
| Focus | ${manifest.counts.focus} |
| Distinct selections | ${manifest.counts.distinctSelections} |
| Runtime external API used | ${manifest.counts.runtimeExternalApiUsed} |

## Review

Open: \`/review/${batchId}/index.html\`

## Boundary

These are rendered route coverage outputs, not new foundational materials and not production release assets.
`;

await writeFile(reportPath, report);

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  reviewUrl: `/review/${batchId}/index.html`,
  productionAllowed: false,
}, null, 2));
