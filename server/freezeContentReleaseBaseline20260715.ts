import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';
const manifestRelativePath = `reports/content-release-manifest-${date}.json`;
const baselineRelativePath = `reports/content-release-baseline-${date}.json`;
const baselineMarkdownRelativePath = `reports/content-release-baseline-${date}.md`;
const handoffRelativePath = `docs/voice-free-beta-content-handoff-${date}.md`;
const replace = process.argv.includes('--replace');

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

const releaseItemFingerprintPayload = (item: any) => ({
  id: item.id,
  category: item.category,
  audioUrl: item.audioUrl,
  fileSha256: item.fileSha256,
  source: item.source,
  license: item.license,
  rightsEvidence: item.rightsEvidence,
  metadataV3: {
    version: item.metadataV3?.version,
    roles: item.metadataV3?.roles,
    concepts: item.metadataV3?.concepts,
    review: item.metadataV3?.review,
  },
});

const run = async () => {
  const baselinePath = path.join(root, baselineRelativePath);
  if (!replace) {
    try {
      await access(baselinePath);
      throw new Error(`${baselineRelativePath} already exists. Use --replace only for an explicitly approved baseline change.`);
    } catch (error) {
      if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error;
    }
  }

  const manifestBytes = await readFile(path.join(root, manifestRelativePath));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.status !== 'pass' || manifest.failures?.length) {
    throw new Error('Content release manifest must pass with zero failures before it can be frozen.');
  }
  if (manifest.counts?.releaseStems !== 111 || manifest.counts?.contentCoverage?.covered !== 16) {
    throw new Error('Expected the approved 111-Stem, 16-subtype Voice-free Beta release pool.');
  }
  if (!Object.values(manifest.gates ?? {}).every(Boolean)) {
    throw new Error('Every content release manifest gate must pass before freezing.');
  }

  const fingerprintItems = manifest.items
    .map(releaseItemFingerprintPayload)
    .sort((left: any, right: any) => left.id.localeCompare(right.id));
  const contentFingerprint = sha256(JSON.stringify(fingerprintItems));
  const evidencePaths = [...new Set<string>(
    manifest.items.flatMap((item: any) => [
      item.rightsEvidence?.sourceSnapshot,
      item.rightsEvidence?.licenseSnapshot,
    ].filter(Boolean)),
  )].sort();
  const evidenceSnapshots = [];
  for (const relativePath of evidencePaths) {
    const bytes = await readFile(path.join(root, relativePath));
    evidenceSnapshots.push({ path: relativePath, sha256: sha256(bytes) });
  }

  const baseline = {
    schemaVersion: 1,
    releaseChannel: 'voice-free-beta',
    status: 'frozen',
    frozenAt: new Date().toISOString(),
    sourceManifest: {
      path: manifestRelativePath,
      generatedAt: manifest.generatedAt,
      sha256: sha256(manifestBytes),
    },
    contentFingerprint,
    counts: manifest.counts,
    gates: manifest.gates,
    allowedCategories: ['Accent', 'Music', 'Nature', 'Noise'],
    prohibitedCategories: ['Voice'],
    evidenceSnapshots,
    changeControl: {
      rule: 'Any approved-pool, audio-file, rights-evidence, license, source, or V3 semantic change requires a new dated manifest, complete content gates, and an explicitly approved replacement baseline.',
      validator: 'pnpm validate:content-release-baseline',
    },
  };

  const baselineMarkdown = `# Voice-free Beta Content Release Baseline

Frozen: ${baseline.frozenAt}

Status: **frozen**

- Release Stems: ${baseline.counts.releaseStems}
- Categories: ${Object.entries(baseline.counts.categories).map(([key, value]) => `${key} ${value}`).join(', ')}
- Effective coverage: ${baseline.counts.contentCoverage.covered} covered / ${baseline.counts.contentCoverage.partial} partial / ${baseline.counts.contentCoverage.gap} gap
- Content fingerprint: \`${baseline.contentFingerprint}\`
- Frozen manifest SHA256: \`${baseline.sourceManifest.sha256}\`
- Rights evidence snapshots: ${baseline.evidenceSnapshots.length}

## Release Boundary

Only the 111 items in the frozen manifest are Voice-free Beta release assets. Candidate downloads, listening previews, loop masters, rendered QA combinations, rejected stems, needs-review stems, and all Voice/TTS assets remain outside the release pool.

## Change Control

Any approved-pool, audio-file, rights-evidence, license, source, or V3 semantic change requires a new dated manifest, complete content gates, and an explicitly approved replacement baseline.

Validate with:

\`\`\`bash
pnpm validate:content-release-baseline
\`\`\`
`;

  const handoff = `# Voice-free Beta 内容包交接说明

日期：${date}  
内容负责人状态：已冻结，可供移动端与播放链路验证使用

## 1. 交付内容

- 发布清单：\`${manifestRelativePath}\`
- 冻结基线：\`${baselineRelativePath}\`
- 内容指纹：\`${contentFingerprint}\`
- 发布素材：111 条
  - Accent 13
  - Music 26
  - Nature 66
  - Noise 6
- 场景覆盖：Sleep 5/5、Calm 5/5、Focus 6/6，共 16/16
- Voice/TTS：不属于本次 Beta，任何可听人声必须 fail closed

## 2. 移动/播放组应使用的内容边界

1. 只能播放发布清单 \`items\` 中列出的音频 URL。
2. 不得从 \`public/audio/candidates\`、试听页、QA 输出、loop master 或临时 render 目录自动发现素材。
3. 长时会话由 Recipe V2 的循环、淡入淡出、时间结构和确定性种子完成；不能要求单个 Stem 文件本身达到 30/60/90/120 分钟。
4. 离线缓存与恢复必须以 \`fileSha256\` 校验文件身份；哈希不一致时不得静默播放。
5. 多轨播放必须保留 Recipe V2 的 Stem、音量、mute、起止时间、循环和自动化关系，不能把“只成功播放一个轨道”算作配方通过。
6. 用户明确排除水声、鸟声、音乐、明亮高频或其他声音时，移动端恢复和离线回放不得绕过排除项。
7. Voice 类、历史 Voice 轨和 TTS 结果不得进入 Live Mix、冻结版本、离线包、系统媒体恢复或最终渲染。

## 3. 内容侧已完成的门禁

- 111/111 发布文件存在。
- 111/111 SHA256 与数据库记录一致。
- ffprobe 的时长、采样率与声道记录一致。
- source、creator、license 和本地权利证据完整。
- V3 语义、角色、概念和审核状态完整。
- Voice-free 检查通过。
- 有效内容覆盖为 16 covered / 0 partial / 0 gap。
- approvedFilesMissing=0，hashMismatches=0。

## 4. 移动/播放组负责验证的事项

以下不是内容组已完成证据，必须由移动/播放组在真实设备上验证：

- iOS/Android 前台、后台与锁屏连续播放。
- 来电、闹钟、耳机拔插、蓝牙切换和音频焦点中断后的暂停/恢复。
- 30/60/90/120 分钟多轨会话稳定性。
- 系统媒体控制的播放、暂停、上一段/下一段或 seek 行为。
- App 被系统回收或重启后的 Recipe、进度、音量和排除项恢复。
- 离线状态下冻结版本的完整多轨或等价渲染回放。

## 5. 交接前自检命令

\`\`\`bash
pnpm audit:assets
pnpm report:effective-coverage-v3
pnpm report:content-release-manifest
pnpm validate:content-release-baseline
pnpm validate:voice-free-beta
\`\`\`

如果内容基线验证失败，不应通过更新期望值来绕过；应回到具体 Stem、版权证据、音频文件或语义记录定位变化，并重新走内容审核和批准流程。
`;

  await Promise.all([
    writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8'),
    writeFile(path.join(root, baselineMarkdownRelativePath), baselineMarkdown, 'utf8'),
    writeFile(path.join(root, handoffRelativePath), handoff, 'utf8'),
  ]);

  console.log(JSON.stringify({
    status: baseline.status,
    releaseStems: baseline.counts.releaseStems,
    contentFingerprint,
    evidenceSnapshots: evidenceSnapshots.length,
    baseline: baselineRelativePath,
    handoff: handoffRelativePath,
  }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
