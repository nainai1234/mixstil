import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';

type StemRow = {
  id: string;
  name: string;
  category: string;
  audio_url: string;
  tags: string[];
  qa_status: string;
  qa_notes: string;
  roles?: string[];
  review_status?: string;
  duration_seconds?: number | null;
  integrated_lufs?: number | null;
  true_peak_db?: number | null;
};

const runProbe = (filePath: string) => {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels', '-of', 'json', filePath], { encoding: 'utf8' });
  if (probe.status !== 0) return { duration: null, sampleRate: null, channels: null };
  const parsed = JSON.parse(probe.stdout);
  const stream = parsed.streams?.find((item: any) => item.sample_rate && item.channels) ?? {};
  return {
    duration: Number(parsed.format?.duration ?? 0) || null,
    sampleRate: Number(stream.sample_rate ?? 0) || null,
    channels: Number(stream.channels ?? 0) || null,
  };
};

const formatNumber = (value: number | null | undefined, digits = 1) => value === null || value === undefined ? 'n/a' : value.toFixed(digits);
const absoluteFile = (root: string, audioUrl: string) => path.join(root, 'public', audioUrl.replace(/^\//, ''));
const audioLink = (audioUrl: string) => `http://localhost:5174${audioUrl}`;
const focusPriority = [
  { id: 'stem_mixkit_music_184', reviewUrl: '/audio/music/review-2026-07-13/focus/vastness_pad.mp3' },
];
const technicalFlag = (row: StemRow) => {
  if ((row.true_peak_db ?? -99) > 0) return '峰值高于 0 dBTP，必须处理';
  if ((row.true_peak_db ?? -99) > -1) return '峰值接近 0 dBTP，必须处理';
  return '机器基线无硬阻断，仍需耳机试听';
};

const run = async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pendingMusic = await query<StemRow>(
    `select s.id,s.name,s.category,s.audio_url,s.tags,s.qa_status,s.qa_notes,
            f.duration_seconds,f.integrated_lufs,f.true_peak_db
     from audio_stems s left join stem_acoustic_features f on f.stem_id=s.id
     where s.category='Music' and s.qa_status='needs_review' order by s.name`,
  );
  const rejectedMusic = await query<StemRow>(
    `select s.id,s.name,s.category,s.audio_url,s.tags,s.qa_status,s.qa_notes,
            f.duration_seconds,f.integrated_lufs,f.true_peak_db
     from audio_stems s left join stem_acoustic_features f on f.stem_id=s.id
     where s.category='Music' and s.qa_status='rejected' order by s.name`,
  );
  const catalogBaseline = await query<StemRow>(
    `select s.id,s.name,s.category,s.audio_url,s.tags,s.qa_status,s.qa_notes,
            m.roles,m.review->>'status' as review_status,
            f.duration_seconds,f.integrated_lufs,f.true_peak_db
     from audio_stems s join stem_metadata_v3 m on m.stem_id=s.id
       left join stem_acoustic_features f on f.stem_id=s.id
     where m.review->>'status'='catalog_baseline' order by s.category,s.name`,
  );
  const musicRows = pendingMusic.rows.map((row) => {
    const measured = row.duration_seconds ? { duration: row.duration_seconds, sampleRate: null, channels: null } : runProbe(absoluteFile(root, row.audio_url));
    return { ...row, ...measured };
  });
  const baselineRows = catalogBaseline.rows;
  const priorityRows = focusPriority.flatMap((priority) => {
    const row = musicRows.find((item) => item.id === priority.id);
    return row ? [{ priority, row }] : [];
  });
  const reportsDir = path.join(root, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const musicLines = [
    '# Internal Music Candidate Review Pack', '',
    `Generated: ${new Date().toISOString()}`, '',
    '用途：内部耳机试听和版权复核，不进入用户产品。只有通过内容、技术、许可和人工听感门槛后，才能更新 `qa_status`。', '',
    '## 优先试听', '',
    '先试听以下三条，判断它们能否补足 deep_focus 的正式 Music 轨；这只是复核顺序，不是自动通过：', '',
    ...priorityRows.map(({ row, priority }, index) => `${index + 1}. [${row.name} - 统一响度试听副本](${audioLink(priority.reviewUrl)}) / [原始文件](${audioLink(row.audio_url)}) - ${row.tags.join(', ')}；原始 ${formatNumber(row.integrated_lufs)} LUFS，${formatNumber(row.true_peak_db)} dBTP，${formatNumber(row.duration_seconds ?? row.duration)} 秒。`),
    '',
    '## 全部候选', '',
    '| Stem | 音频 | 标签 | 时长 | LUFS | True Peak | 技术预筛 | 试听结论 |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- |',
    ...musicRows.map((row) => `| \`${row.id}\` | [${row.name}](${audioLink(row.audio_url)}) | ${row.tags.join(', ')} | ${formatNumber(row.duration_seconds ?? row.duration)}s | ${formatNumber(row.integrated_lufs)} | ${formatNumber(row.true_peak_db)} | ${technicalFlag(row)} | 待填写：scene fit / loop / fatigue / Content ID / pass-fix-reject |`),
    '',
    '## 已拒绝的音乐', '',
    ...(rejectedMusic.rows.length
      ? rejectedMusic.rows.map((row) => `- \`${row.id}\` ${row.name}: ${row.qa_notes}`)
      : ['- None']),
    '',
    '## 每条必须确认', '',
    '- 是否真的是标签所描述的音乐，而不是自然声、风声或水声。',
    '- 是否适合 `music.bed`，还是只能作为 `accent.event`。',
    '- 是否有明显旋律催促、突发峰值、刺耳高频或长时间重复疲劳。',
    '- 起止、循环接缝和30分钟以上重复是否自然。',
    '- 是否可以作为 deep_focus、bedtime 或 emotional_settling 的正式候选。',
    '- Mixkit许可快照、商业衍生权和Content ID风险是否已记录。',
    '',
    '## 放行规则', '',
    '`needs_review` -> `approved` 只能由人工听感、版权快照和技术 QA 同时通过后执行；本文件不会自动改变数据库状态。',
  ];
  const baselineLines = [
    '# Internal Catalog Baseline Review Pack', '',
    `Generated: ${new Date().toISOString()}`, '',
    '用途：复核35条 catalog baseline 的 source、role、goal fit 和风险，不进入用户产品导航。', '',
    '| 类别 | Stem | 音频 | 当前角色 | 时长 | LUFS | True Peak | 复核重点 |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- |',
    ...baselineRows.map((row) => `| ${row.category} | \`${row.id}\` ${row.name} | [试听](${audioLink(row.audio_url)}) | ${(row.roles ?? []).join(', ')} | ${formatNumber(row.duration_seconds)}s | ${formatNumber(row.integrated_lufs)} | ${formatNumber(row.true_peak_db)} | 确认 source / role / goal fit / 风险 / 循环 |`),
    '',
    '复核完成后，只更新对应素材的 metadata review 状态；不要因为“能播放”就直接提高 goal fit，也不要改变 `qa_status` 的版权含义。',
  ];
  await writeFile(path.join(reportsDir, 'music-candidate-review-2026-07-13.md'), `${musicLines.join('\n')}\n`, 'utf8');
  await writeFile(path.join(reportsDir, 'catalog-baseline-review-2026-07-13.md'), `${baselineLines.join('\n')}\n`, 'utf8');
  console.log(JSON.stringify({
    musicCandidates: musicRows.length,
    rejectedMusic: rejectedMusic.rows.length,
    catalogBaseline: baselineRows.length,
    musicReport: 'reports/music-candidate-review-2026-07-13.md',
    catalogReport: 'reports/catalog-baseline-review-2026-07-13.md',
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
