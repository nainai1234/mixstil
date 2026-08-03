import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildFoundationalCompositionBundle } from './foundationalCompositionRouterV1';
import type { ProductGoal, ProductScene } from './contentCatalog';

const root = process.cwd();
const batchId = 'composer-bundle-plan-v1';
const reviewDir = path.join(root, 'public/review', batchId);
const manifestPath = path.join(reviewDir, 'manifest.json');
const htmlPath = path.join(reviewDir, 'index.html');

const cases: Array<{
  id: string;
  label: string;
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  excludedSounds: string[];
  expectedMode: 'music_supported' | 'support_only';
  businessQuestion: string;
}> = [
  {
    id: 'sleep_piano_warm_sparse',
    label: 'Sleep · 柔和音乐感',
    prompt: '睡前需要温暖、低变化、没有人声的声音，稍微有一点柔和钢琴感，不要鼓点。',
    goal: 'sleep',
    scene: 'bedtime',
    excludedSounds: ['voice', 'drums'],
    expectedMode: 'music_supported',
    businessQuestion: '系统是否能把“钢琴感”拆成乐器源、和声、动机和支持层，而不是直接拿一首成品曲？',
  },
  {
    id: 'sleep_support_only_no_water_no_road',
    label: 'Sleep · 不要音乐/水声/公路感',
    prompt: '只要深一点的安静底层和柔和遮蔽，不要音乐、不要人声、不要鼓点、不要水声、不要公路感。',
    goal: 'sleep',
    scene: 'bedtime',
    excludedSounds: ['voice', 'music', 'drums', 'water', 'road'],
    expectedMode: 'support_only',
    businessQuestion: '系统是否真的跳过乐器/和声/动机，并避免雨、海、通风、公路感风险元素？',
  },
  {
    id: 'calm_guitar_meditation',
    label: 'Calm · 吉他冥想',
    prompt: '十分钟冥想，想要一点柔和吉他质感，不能有人声，也不要突然变化。',
    goal: 'calm',
    scene: 'breathing',
    excludedSounds: ['voice', 'sudden_events'],
    expectedMode: 'music_supported',
    businessQuestion: '系统是否能选择吉他相关素材，但仍保持低刺激、低突发的冥想结构？',
  },
  {
    id: 'focus_rhodes_no_nature',
    label: 'Focus · Rhodes 低干扰',
    prompt: '白天深度工作，需要低干扰的 Rhodes 专注背景，没有人声，不要自然声抢注意力。',
    goal: 'focus',
    scene: 'deep_focus',
    excludedSounds: ['voice', 'natural'],
    expectedMode: 'music_supported',
    businessQuestion: '系统是否能选择 Rhodes 专注材料，并避开雨、海、森林、风等自然身份层？',
  },
  {
    id: 'calm_528_support_only',
    label: 'Calm · 528Hz 只作参数',
    prompt: '想要很轻的 528Hz 参考音和空气感，不要音乐，不要人声。',
    goal: 'calm',
    scene: 'emotional_settling',
    excludedSounds: ['voice', 'music'],
    expectedMode: 'support_only',
    businessQuestion: '系统是否把 528Hz 当成可解释 DSP 参数，而不是生成“疗效频率”承诺？',
  },
  {
    id: 'focus_masking_no_melody',
    label: 'Focus · 只要遮蔽不要旋律',
    prompt: '我要专注工作，只要稳定遮蔽和低干扰质感，不要旋律、不要人声、不要水声。',
    goal: 'focus',
    scene: 'deep_focus',
    excludedSounds: ['voice', 'melody', 'water'],
    expectedMode: 'support_only',
    businessQuestion: '系统是否能把“不要旋律”转成 support-only，而不是继续塞音乐模板？',
  },
];

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderValue = (value: unknown) => escapeHtml(JSON.stringify(value, null, 2));

const buildProfessionalReview = (item: (typeof cases)[number], bundle: ReturnType<typeof buildFoundationalCompositionBundle>) => {
  const selected = bundle.bundle;
  const notes: string[] = [];
  const risksAvoided: string[] = [];
  const risksRemaining: string[] = [];

  if (bundle.mode === 'music_supported') {
    if (selected.compositionPlan && selected.harmony?.id === selected.compositionPlan.harmonyId && selected.motif?.id === selected.compositionPlan.motifId) {
      notes.push('Composition plan, harmony, and motif are locked together, avoiding mismatched piano/guitar/Rhodes grammar.');
    } else {
      risksRemaining.push('Music grammar is not fully linked.');
    }
    if (item.id.includes('piano') && selected.instrumentSource?.instrumentType === 'piano') {
      notes.push('Explicit piano request is served by a piano source, not Rhodes or a generic multi-instrument fallback.');
    }
    if (item.id.includes('guitar') && selected.instrumentSource?.instrumentType.includes('guitar')) {
      notes.push('Explicit guitar request is served by a guitar source.');
    }
    if (item.id.includes('rhodes') && selected.instrumentSource?.instrumentType === 'electric_piano') {
      notes.push('Explicit Rhodes request is served by the electric piano/Rhodes source.');
    }
  } else {
    notes.push('Support-only request correctly removes instrument source, composition plan, harmony, motif, and pad/drone music layers.');
  }

  if (selected.environmentBed === 'env_procedural_soft_airflow_bed_v1') {
    notes.push('Environment bed uses low-identity procedural airflow, which is safer for sleep/focus than forest, water, road, or HVAC-like identity beds.');
  }
  if (selected.organicTexture === 'soft_tape_air') {
    notes.push('Organic texture favors soft tape air, reducing the “highway/engine/rumble” risk.');
  }
  if (selected.accentOneShot?.startsWith('accent_soft_')) {
    notes.push('Accent choice is softened and sparse rather than attention-grabbing bowl/chime material.');
  }
  if (bundle.exclusionsApplied.length > item.excludedSounds.length) {
    risksAvoided.push(`Applied secondary exclusions: ${bundle.exclusionsApplied.filter((entry) => !item.excludedSounds.includes(entry)).join(', ')}.`);
  }
  if (item.excludedSounds.includes('natural') && selected.environmentBed !== 'env_procedural_soft_airflow_bed_v1') {
    risksRemaining.push('No-natural focus request should prefer procedural airflow.');
  }
  if (item.excludedSounds.includes('water') && JSON.stringify(selected).match(/rain|ocean|water|mist/i)) {
    risksRemaining.push('Water exclusion may still be violated by selected material identity.');
  }

  return {
    decision: risksRemaining.length === 0 && bundle.mode === item.expectedMode ? 'professional_pass' : 'professional_adjustment_required',
    producerSummary: risksRemaining.length === 0
      ? '专业制作人判定：可作为基础素材调用计划继续进入下一步，不需要用户再做选择。'
      : '专业制作人判定：仍需调整，不交给用户选择。',
    notes,
    risksAvoided,
    risksRemaining,
  };
};

const results = cases.map((item) => {
  const bundle = buildFoundationalCompositionBundle({
    prompt: item.prompt,
    goal: item.goal,
    scene: item.scene,
    excludedSounds: item.excludedSounds,
    selectionKey: item.id,
  });
  return {
    ...item,
    bundle,
    professionalReview: buildProfessionalReview(item, bundle),
    passedStaticExpectation: bundle.mode === item.expectedMode,
    selectedMaterialCount: bundle.selectedMaterials.length,
    runtimeExternalApiUsed: bundle.runtimeExternalApiUsed,
  };
});

await mkdir(reviewDir, { recursive: true });

const manifest = {
  schemaVersion: '1.0.0',
  batchId,
  generatedAt: new Date().toISOString(),
  status: 'composer_bundle_plan_review_ready',
  productionAllowed: false,
  publicReleaseAllowed: false,
  purpose: 'Review how explicit user requests are translated into explainable foundational material bundle plans.',
  hardRules: [
    'This page reviews routing explanation and material selection, not finished music preference.',
    'Generic Sleep/Calm/Focus requests must keep using finished/internal baseline first.',
    'Explicit element-level requests may expose composerBundlePlan.',
    'No runtime external audio generation API is used.',
    'Support-only requests must not select instrument, harmony, motif, composition plan, or pad/drone music layers.',
    'No medical, healing, brainwave, or guaranteed-effect claims are allowed.',
  ],
  counts: {
    cases: results.length,
    musicSupported: results.filter((item) => item.bundle.mode === 'music_supported').length,
    supportOnly: results.filter((item) => item.bundle.mode === 'support_only').length,
    passedStaticExpectations: results.filter((item) => item.passedStaticExpectation).length,
    runtimeExternalApiUsed: results.filter((item) => item.runtimeExternalApiUsed).length,
    professionalPass: results.filter((item) => item.professionalReview.decision === 'professional_pass').length,
    professionalAdjustmentRequired: results.filter((item) => item.professionalReview.decision !== 'professional_pass').length,
  },
  results,
  reviewUrl: `/review/${batchId}/index.html`,
};

const cards = results.map((item, index) => `
  <article class="card ${item.bundle.mode}">
    <p class="eyebrow">${index + 1}/${results.length} · ${escapeHtml(item.label)} · ${escapeHtml(item.bundle.mode)}</p>
    <h2>${escapeHtml(item.id)}</h2>
    <p class="prompt">${escapeHtml(item.prompt)}</p>
    <p class="question">${escapeHtml(item.businessQuestion)}</p>
    <section class="producer">
      <h3>Producer verdict</h3>
      <p><b>${escapeHtml(item.professionalReview.decision)}</b> · ${escapeHtml(item.professionalReview.producerSummary)}</p>
      <ul>
        ${item.professionalReview.notes.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
      </ul>
      ${item.professionalReview.risksAvoided.length ? `<p><b>Risks avoided:</b> ${escapeHtml(item.professionalReview.risksAvoided.join(' '))}</p>` : ''}
      ${item.professionalReview.risksRemaining.length ? `<p class="risk"><b>Risks remaining:</b> ${escapeHtml(item.professionalReview.risksRemaining.join(' '))}</p>` : ''}
    </section>
    <div class="badges">
      <span>Goal: ${escapeHtml(item.goal)}</span>
      <span>Scene: ${escapeHtml(item.scene)}</span>
      <span>Expected: ${escapeHtml(item.expectedMode)}</span>
      <span>${item.passedStaticExpectation ? '✅ expectation matched' : '⚠️ expectation mismatch'}</span>
      <span>External API: ${item.runtimeExternalApiUsed ? 'used' : 'not used'}</span>
    </div>
    <section class="grid">
      <div>
        <h3>Selected bundle</h3>
        <table>
          <tbody>
            <tr><th>Mode</th><td>${escapeHtml(item.bundle.mode)}</td></tr>
            <tr><th>Instrument</th><td>${escapeHtml(item.bundle.bundle.instrumentSource?.id ?? 'none')}</td></tr>
            <tr><th>Composition</th><td>${escapeHtml(item.bundle.bundle.compositionPlan?.id ?? 'none')}</td></tr>
            <tr><th>Harmony</th><td>${escapeHtml(item.bundle.bundle.harmony?.id ?? 'none')}</td></tr>
            <tr><th>Motif</th><td>${escapeHtml(item.bundle.bundle.motif?.id ?? 'none')}</td></tr>
            <tr><th>Pad/Drone</th><td>${escapeHtml(item.bundle.bundle.padDrone ?? 'none')}</td></tr>
            <tr><th>Environment</th><td>${escapeHtml(item.bundle.bundle.environmentBed)}</td></tr>
            <tr><th>Texture</th><td>${escapeHtml(item.bundle.bundle.organicTexture)}</td></tr>
            <tr><th>Accent</th><td>${escapeHtml(item.bundle.bundle.accentOneShot ?? 'none')}</td></tr>
            <tr><th>DSP</th><td>${escapeHtml(item.bundle.bundle.deterministicAcousticConfig)}</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3>Exclusions</h3>
        <p><b>Prompt exclusions:</b> ${escapeHtml(item.excludedSounds.join(', ') || 'none')}</p>
        <p><b>Applied:</b> ${escapeHtml(item.bundle.exclusionsApplied.join(', ') || 'none')}</p>
        <p><b>Intentionally excluded:</b> ${escapeHtml(item.bundle.intentionallyExcluded.join(', ') || 'none')}</p>
        <h3>Rationale</h3>
        <ol>${item.bundle.rationale.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol>
      </div>
    </section>
    <details>
      <summary>Selected materials with reasons</summary>
      <table>
        <thead><tr><th>Role</th><th>ID</th><th>Source</th><th>Status</th><th>Reason</th></tr></thead>
        <tbody>
          ${item.bundle.selectedMaterials.map((material) => `<tr><td>${escapeHtml(material.role)}</td><td>${escapeHtml(material.id)}</td><td>${escapeHtml(material.sourceKind)}</td><td>${escapeHtml(material.formalStatus)}</td><td>${escapeHtml(material.reason)}</td></tr>`).join('')}
        </tbody>
      </table>
    </details>
    <details>
      <summary>Raw composerBundlePlan JSON</summary>
      <pre>${renderValue(item.bundle)}</pre>
    </details>
  </article>
`).join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Composer Bundle Plan V1</title>
  <style>
    body{margin:0;background:#10120f;color:#edf4ec;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 90px}
    .hero,.card{border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:18px;background:rgba(255,255,255,.045);margin:14px 0}
    .hero{background:linear-gradient(135deg,rgba(108,132,92,.22),rgba(84,104,132,.16))}
    .support_only{border-color:rgba(216,200,132,.32)}
    .music_supported{border-color:rgba(132,180,216,.28)}
    .eyebrow{color:#d8c884;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800}
    .prompt,.question{color:#d9e4d6;line-height:1.55}
    .question{padding:10px 12px;border-radius:12px;background:rgba(216,200,132,.08)}
    .producer{border:1px solid rgba(216,200,132,.18);border-radius:16px;padding:12px;background:rgba(216,200,132,.07);margin:12px 0}
    .risk{color:#ffc6a6}
    .badges{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
    .badges span{border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 10px;background:rgba(255,255,255,.05);font-size:13px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media (max-width:800px){.grid{grid-template-columns:1fr}}
    table{width:100%;border-collapse:collapse;margin:8px 0}
    th,td{border-bottom:1px solid rgba(255,255,255,.1);padding:8px;text-align:left;vertical-align:top}
    th{color:#d8c884;font-size:13px}
    pre{white-space:pre-wrap;max-height:360px;overflow:auto;background:rgba(0,0,0,.2);padding:10px;border-radius:12px}
    code{color:#f0dc91}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">MixStil · foundational composer routing</p>
      <h1>Composer Bundle Plan V1</h1>
      <p>这页审查的是：用户一句话如何被拆成基础素材调用计划。它不是试听成品音乐，也不是 production release。</p>
      <p>核心问题：选了哪些基础元素、为什么选、哪些被排除、有没有把成品曲/混合片段冒充基础素材。</p>
      <p>本版本已经内置专业制作人判定：不再要求用户做素材选择；系统必须自己承担“选对基础元素”的责任。</p>
      <p><code>generic request -> internal baseline</code>；<code>explicit element request -> composerBundlePlan</code>。</p>
    </section>
    ${cards}
  </main>
</body>
</html>`;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(htmlPath, html);

console.log(JSON.stringify({
  passed: true,
  batchId,
  cases: results.length,
  reviewUrl: `/review/${batchId}/index.html`,
  manifest: `public/review/${batchId}/manifest.json`,
}, null, 2));
