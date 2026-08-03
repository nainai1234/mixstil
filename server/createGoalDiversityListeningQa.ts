import { copyFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type Json = Record<string, any>;

type QaCase = {
  id: string;
  blindLabel: string;
  goal: 'sleep' | 'calm' | 'focus';
  prompt: string;
  expectedTracks: number;
  expectedMode: 'pure_soundscape' | 'sound_journey' | 'functional_music';
};

type GeneratedItem = QaCase & {
  mixId: string;
  title: string;
  contentMode: string;
  provider: string;
  audioUrl: string;
  localPath: string;
  tracks: Array<{ role: string; name: string; volume: number; automationPoints: number }>;
  automaticQa: Json | null;
};

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8788';
const outputDirectory = path.join(process.cwd(), 'public/review/goal-diversity-listening-qa');
const reportDirectory = path.join(process.cwd(), 'reports');
const reportPath = path.join(reportDirectory, 'goal-diversity-listening-qa-latest.json');
const python = path.join(process.cwd(), '.venv-audio/bin/python');

const cases: QaCase[] = [
  {
    id: 'single-noise-baseline', blindLabel: 'A', goal: 'sleep', expectedTracks: 1, expectedMode: 'pure_soundscape',
    prompt: '睡前只要柔和粉噪音，不要音乐、自然声和人声',
  },
  {
    id: 'sleep-layered', blindLabel: 'B', goal: 'sleep', expectedTracks: 2, expectedMode: 'pure_soundscape',
    prompt: '脑子停不下来，想慢慢安静入睡，不要人声、音乐和水声',
  },
  {
    id: 'calm-journey', blindLabel: 'C', goal: 'calm', expectedTracks: 2, expectedMode: 'sound_journey',
    prompt: '我想做十分钟冥想，让情绪慢慢安静下来，不要人声',
  },
  {
    id: 'focus-functional', blindLabel: 'D', goal: 'focus', expectedTracks: 2, expectedMode: 'functional_music',
    prompt: 'Help me focus on detailed work without voices or nature sounds',
  },
];

let token = '';
const originalExports = new Set<string>();

const request = async (pathname: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${pathname}: ${body.error ?? response.statusText} ${JSON.stringify(body.unmetRequirements ?? [])}`);
  return body;
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const ratingControl = (itemId: string, key: string, label: string) => `
  <fieldset class="rating" data-score="${escapeHtml(key)}">
    <legend>${escapeHtml(label)}</legend>
    ${[1, 2, 3, 4, 5].map((score) => `<label><input type="radio" name="${escapeHtml(key)}-${escapeHtml(itemId)}" value="${score}"><span>${score}</span></label>`).join('')}
  </fieldset>`;

const analyzeLoudness = (filePath: string) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', filePath, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const lastNumber = (pattern: RegExp) => {
    const matches = Array.from(output.matchAll(pattern));
    return matches.length ? Number(matches[matches.length - 1][1]) : null;
  };
  return {
    integratedLufs: lastNumber(/I:\s*(-?[\d.]+) LUFS/g),
    truePeakDb: lastNumber(/Peak:\s*(-?[\d.]+) dBFS/g),
  };
};

const runDiversityAnalysis = () => {
  if (!existsSync(python)) throw new Error('The bundled audio analysis environment is missing.');
  const result = spawnSync(python, ['scripts/analyze-collection-diversity.py', outputDirectory, '--threshold', '0.98'], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || 'Collection diversity analysis failed.');
  return JSON.parse(result.stdout);
};

const createHtml = (items: GeneratedItem[], diversity: Json) => {
  const cards = items.map((item) => `
    <article class="sample" data-id="${escapeHtml(item.id)}">
      <header>
        <div class="blind-label">${escapeHtml(item.blindLabel)}</div>
        <div class="identity" hidden>
          <h2>${escapeHtml(item.title)}</h2>
          <p>${escapeHtml(item.goal)} · ${escapeHtml(item.contentMode)} · ${item.tracks.length} tracks</p>
        </div>
      </header>
      <audio controls preload="metadata" src="${escapeHtml(item.audioUrl)}"></audio>
      <section class="evaluation" aria-label="Evaluation for sample ${escapeHtml(item.blindLabel)}">
      <div class="evaluation-title"><strong>听完后记录判断</strong><span>仅记录评价，不会改变声音</span></div>
      <fieldset>
        <legend>你认为它属于哪一类？</legend>
        <label><input type="radio" name="guess-${escapeHtml(item.id)}" value="single_noise"> Single noise</label>
        <label><input type="radio" name="guess-${escapeHtml(item.id)}" value="sleep"> Sleep</label>
        <label><input type="radio" name="guess-${escapeHtml(item.id)}" value="calm"> Calm</label>
        <label><input type="radio" name="guess-${escapeHtml(item.id)}" value="focus"> Focus</label>
      </fieldset>
      <div class="ratings">
        ${ratingControl(item.id, 'sceneFit', '场景贴合度（1 低，5 高）')}
        ${ratingControl(item.id, 'distinct', '与单一噪音的差异（1 小，5 大）')}
        ${ratingControl(item.id, 'balance', '多层声音平衡度（1 差，5 好）')}
        ${ratingControl(item.id, 'comfort', '长时间聆听舒适度（1 低，5 高）')}
      </div>
      <textarea aria-label="Notes for sample ${escapeHtml(item.blindLabel)}" placeholder="记录你实际听到的声音；如果听不出区别，请直接写“没有区别”"></textarea>
      </section>
      <div class="details identity" hidden>
        ${item.tracks.map((track) => `<span>${escapeHtml(track.role)}: ${escapeHtml(track.name)} · volume ${track.volume} · ${track.automationPoints} automation points</span>`).join('')}
      </div>
    </article>`).join('\n');

  const pairRows = (diversity.pairs ?? []).map((pair: Json) => `
    <tr><td>${escapeHtml(pair.left)}</td><td>${escapeHtml(pair.right)}</td><td>${escapeHtml(pair.spectralCorrelation)}</td><td>${pair.nearDuplicate ? 'near duplicate' : 'distinct'}</td></tr>`).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MixStil Goal Diversity Listening QA</title>
  <style>
    :root { color-scheme: light; --ink:#151918; --muted:#66706c; --line:#d7ddda; --surface:#f3f5f4; --panel:#fff; --accent:#176b5b; --warn:#a14f22; }
    * { box-sizing:border-box; }
    [hidden] { display:none !important; }
    body { margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--surface); color:var(--ink); }
    .topbar { position:sticky; top:0; z-index:5; border-bottom:1px solid var(--line); background:rgba(243,245,244,.96); backdrop-filter:blur(10px); }
    .topbar-inner, main { width:min(1080px,calc(100% - 28px)); margin:0 auto; }
    .topbar-inner { min-height:68px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    h1 { margin:0; font-size:20px; letter-spacing:0; }
    button { min-height:38px; padding:0 12px; border:1px solid var(--line); border-radius:6px; background:#fff; color:var(--ink); font:inherit; cursor:pointer; }
    button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    main { padding:18px 0 48px; }
    .status { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:14px; font-size:13px; color:var(--muted); }
    .status strong { color:${diversity.status === 'pass' ? 'var(--accent)' : 'var(--warn)'}; }
    .instructions { margin:0 0 14px; padding:12px 14px; border:1px solid #c6d7d2; border-left:4px solid var(--accent); border-radius:6px; background:#fff; }
    .instructions strong { display:block; margin-bottom:5px; font-size:14px; }
    .instructions p { margin:0; font-size:13px; line-height:1.55; color:var(--ink); }
    .instructions .warning { margin-top:5px; color:var(--warn); font-weight:650; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .sample { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; min-width:0; }
    .sample header { min-height:50px; display:flex; align-items:center; gap:12px; }
    .blind-label { width:42px; height:42px; display:grid; place-items:center; border:1px solid var(--line); border-radius:6px; font-size:20px; font-weight:760; }
    h2 { margin:0; font-size:16px; letter-spacing:0; }
    p { margin:4px 0 0; color:var(--muted); font-size:12px; }
    audio { width:100%; margin:12px 0; }
    .evaluation { margin-top:4px; padding-top:10px; border-top:1px dashed var(--line); }
    .evaluation-title { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; font-size:13px; }
    .evaluation-title span { padding:3px 6px; border:1px solid #e4cfc2; border-radius:4px; color:var(--warn); background:#fff8f4; font-size:11px; }
    fieldset { display:flex; flex-wrap:wrap; gap:10px 16px; margin:0; padding:10px; border:1px solid var(--line); border-radius:6px; }
    legend { padding:0 5px; color:var(--muted); font-size:12px; }
    fieldset label { font-size:13px; }
    .ratings { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:12px 0; }
    .rating { display:grid; grid-template-columns:repeat(5,1fr); gap:4px; margin:0; padding:8px; border:1px solid var(--line); border-radius:6px; }
    .rating legend { padding:0 4px; color:var(--muted); font-size:12px; }
    .rating label { position:relative; }
    .rating input { position:absolute; opacity:0; pointer-events:none; }
    .rating span { min-height:32px; display:grid; place-items:center; border:1px solid var(--line); border-radius:5px; font-size:13px; cursor:pointer; }
    .rating input:checked + span { color:#fff; background:var(--accent); border-color:var(--accent); }
    .rating input:focus-visible + span { outline:2px solid var(--accent); outline-offset:2px; }
    textarea { width:100%; min-height:66px; resize:vertical; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; }
    .details { display:grid; gap:5px; margin-top:10px; padding-top:10px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
    .analysis { margin-top:16px; overflow:auto; background:#fff; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th,td { padding:9px 10px; border-bottom:1px solid var(--line); text-align:left; white-space:nowrap; }
    th { color:var(--muted); font-weight:650; }
    @media (max-width:760px) { .grid{grid-template-columns:1fr;} .topbar-inner{align-items:flex-start; padding:12px 0; flex-direction:column;} .ratings{grid-template-columns:1fr;} .evaluation-title{align-items:flex-start; flex-direction:column;} }
  </style>
</head>
<body>
  <div class="topbar"><div class="topbar-inner"><h1>目标差异盲听验收</h1><div><button id="reveal">揭晓样本</button> <button class="primary" id="export">导出评价</button></div></div></div>
  <main>
    <div class="status"><span>4 个盲听样本 · 每段 5 分钟</span><span>机器查重：<strong>${escapeHtml(diversity.status)}</strong> · 最高相关度 ${escapeHtml(diversity.maxSpectralCorrelation)}</span></div>
    <section class="instructions" aria-label="测试说明">
      <strong>这是一组盲听验收，不是调音器。</strong>
      <p>真正会改变声音的只有每张卡片上方的播放器。请分别播放 A、B、C、D，建议每段连续听 20–30 秒，再在下方记录你听到后的分类和评分。</p>
      <p class="warning">下方所有选项只保存评价，点击不会改变音频。若仍听不出差异，这就是有效的失败结果，请直接记录“没有区别”。</p>
    </section>
    <section class="grid">${cards}</section>
    <section class="analysis identity" hidden>
      <table><thead><tr><th>Left</th><th>Right</th><th>Spectral correlation</th><th>Machine verdict</th></tr></thead><tbody>${pairRows}</tbody></table>
    </section>
  </main>
  <script>
    const storageKey = 'snooze.goalDiversityQa.v3';
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const samples = [...document.querySelectorAll('.sample')];
    const players = [...document.querySelectorAll('audio')];
    players.forEach((player) => player.addEventListener('play', () => {
      players.forEach((other) => { if (other !== player) other.pause(); });
    }));
    const capture = () => {
      const result = {};
      samples.forEach((sample) => {
        result[sample.dataset.id] = {
          guess: sample.querySelector('input[type=radio]:checked')?.value || '',
          sceneFit: sample.querySelector('[data-score=sceneFit] input:checked')?.value || '',
          distinct: sample.querySelector('[data-score=distinct] input:checked')?.value || '',
          balance: sample.querySelector('[data-score=balance] input:checked')?.value || '',
          comfort: sample.querySelector('[data-score=comfort] input:checked')?.value || '',
          notes: sample.querySelector('textarea').value,
        };
      });
      localStorage.setItem(storageKey, JSON.stringify(result));
      return result;
    };
    samples.forEach((sample) => {
      const prior = saved[sample.dataset.id] || {};
      if (prior.guess) sample.querySelector('input[value="' + prior.guess + '"]')?.click();
      ['sceneFit','distinct','balance','comfort'].forEach((key) => {
        if (prior[key]) sample.querySelector('[data-score=' + key + '] input[value="' + prior[key] + '"]')?.click();
      });
      sample.querySelector('textarea').value = prior.notes || '';
      sample.addEventListener('change', capture);
      sample.querySelector('textarea').addEventListener('input', capture);
    });
    document.getElementById('reveal').addEventListener('click', (event) => {
      const revealing = document.querySelector('.identity').hidden;
      document.querySelectorAll('.identity').forEach((node) => { node.hidden = !revealing; });
      event.currentTarget.textContent = revealing ? '隐藏答案' : '揭晓样本';
    });
    document.getElementById('export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ generatedAt:new Date().toISOString(), results:capture() }, null, 2)], { type:'application/json' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'goal-diversity-listening-results.json'; link.click(); URL.revokeObjectURL(link.href);
    });
  </script>
</body>
</html>`;
};

const main = async () => {
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(reportDirectory, { recursive: true });
  const guest = await request('/api/auth/guest', { method: 'POST' });
  token = String(guest.token ?? '');
  if (!token) throw new Error('Could not create the temporary QA session.');

  const items: GeneratedItem[] = [];
  try {
    for (const item of cases) {
      const created = await request('/api/quick-create', {
        method: 'POST',
        body: JSON.stringify({ goal: item.goal, prompt: item.prompt, durationSeconds: 300 }),
      });
      if (created.audioIntent?.contentMode !== item.expectedMode) {
        throw new Error(`${item.id}: expected ${item.expectedMode}, received ${created.audioIntent?.contentMode}`);
      }
      if (created.tracks?.length !== item.expectedTracks) {
        throw new Error(`${item.id}: expected ${item.expectedTracks} tracks, received ${created.tracks?.length ?? 0}`);
      }
      const rendered = await request(`/api/mixes/${created.mix.id}/render`, { method: 'POST', body: '{}' });
      const sourceUrl = String(rendered.renderedAudioUrl ?? '');
      if (!sourceUrl.startsWith('/exports/')) throw new Error(`${item.id}: render did not return a local export.`);
      const sourcePath = path.join(process.cwd(), 'public', sourceUrl.slice(1));
      const targetFilename = `${item.blindLabel.toLowerCase()}-${item.id}.mp3`;
      const targetPath = path.join(outputDirectory, targetFilename);
      await copyFile(sourcePath, targetPath);
      originalExports.add(sourcePath);
      items.push({
        ...item,
        mixId: created.mix.id,
        title: created.mix.title,
        contentMode: created.audioIntent.contentMode,
        provider: created.planning.provider,
        audioUrl: `/review/goal-diversity-listening-qa/${targetFilename}`,
        localPath: targetPath,
        tracks: created.tracks.map((track: Json) => ({
          role: String(track.role ?? ''), name: String(track.name ?? ''), volume: Number(track.volume ?? 0),
          automationPoints: Array.isArray(track.volumeAutomation) ? track.volumeAutomation.length : 0,
        })),
        automaticQa: rendered.qaReport ?? null,
      });
    }
  } finally {
    if (token) {
      await fetch(`${API_BASE}/api/me`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}`, 'x-confirm-account-deletion': 'DELETE' },
      }).catch(() => undefined);
    }
    await Promise.all([...originalExports].map((filePath) => unlink(filePath).catch(() => undefined)));
  }

  const diversity = runDiversityAnalysis();
  const loudness = Object.fromEntries(items.map((item) => [item.id, analyzeLoudness(item.localPath)]));
  const report = {
    generatedAt: new Date().toISOString(),
    status: diversity.status === 'pass' && items.every((item) => item.automaticQa?.passed) ? 'machine_pass_human_pending' : 'needs_review',
    items: items.map(({ localPath: _localPath, ...item }) => item),
    loudness,
    diversity,
    humanListeningStatus: 'pending',
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputDirectory, 'index.html'), createHtml(items, diversity), 'utf8');
  console.log(JSON.stringify({
    passed: true,
    page: 'http://localhost:5174/review/goal-diversity-listening-qa/index.html',
    report: path.relative(process.cwd(), reportPath),
    trackCounts: items.map((item) => [item.id, item.tracks.length]),
    diversity: { status: diversity.status, maxSpectralCorrelation: diversity.maxSpectralCorrelation, nearDuplicatePairCount: diversity.nearDuplicatePairCount },
  }, null, 2));
};

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
