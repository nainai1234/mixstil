import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';
const expectedReleaseStemCount = 111;

type ReleaseStemRow = {
  id: string;
  name: string;
  category: string;
  audio_url: string;
  tags: string[];
  default_volume: number;
  source_platform: string;
  source_url: string;
  source_item_id: string;
  source_creator: string;
  license_name: string;
  license_url: string;
  attribution_required: boolean;
  raw_redistribution_allowed: boolean;
  file_sha256: string;
  qa_notes: string;
  duration_seconds: number;
  sample_rate: number;
  channels: number;
  integrated_lufs: number | null;
  true_peak_db: number | null;
  analysis_version: string;
  metadata_version: number;
  semantic_descriptions: string[];
  roles: string[];
  goal_fit: unknown;
  temporal_profile: unknown;
  mix_profile: unknown;
  risks: unknown;
  review: { status?: string; contentVerifiedAt?: string; reviewerIds?: string[] };
};

const evidenceForStem = (stem: ReleaseStemRow) => {
  if (stem.source_url.startsWith('internal://')) {
    return { mode: 'project_owned', sourceSnapshot: null, licenseSnapshot: null };
  }
  if (stem.source_platform === 'Mixkit') {
    return {
      mode: 'platform_license_snapshot',
      sourceSnapshot: null,
      licenseSnapshot: 'docs/license-snapshots/batch-08/mixkit-license.html',
    };
  }
  const specific: Record<string, { sourceSnapshot: string; licenseSnapshot?: string }> = {
    stem_batch07_fma_holizna_rain_sleep: { sourceSnapshot: 'docs/license-snapshots/batch-07/fma-holizna-rain-sleep.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc0-1-0.license.html' },
    stem_batch07_fma_holizna_cosmic_waves: { sourceSnapshot: 'docs/license-snapshots/batch-07/fma-holizna-cosmic-waves.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc0-1-0.license.html' },
    stem_batch07_fma_holizna_meditation_01: { sourceSnapshot: 'docs/license-snapshots/batch-07/fma-holizna-meditation-01.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc0-1-0.license.html' },
    stem_batch07_fma_holizna_dreamscape: { sourceSnapshot: 'docs/license-snapshots/batch-07/fma-holizna-dreamscape.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc0-1-0.license.html' },
    stem_batch07_incompetech_meditation_impromptu_01: { sourceSnapshot: 'docs/license-snapshots/batch-07/incompetech-meditation-impromptu-01.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc-by-4-0.license.html' },
    stem_batch07_incompetech_meditation_impromptu_02: { sourceSnapshot: 'docs/license-snapshots/batch-07/incompetech-meditation-impromptu-02.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc-by-4-0.license.html' },
    stem_batch07_incompetech_meditation_impromptu_03: { sourceSnapshot: 'docs/license-snapshots/batch-07/incompetech-meditation-impromptu-03.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc-by-4-0.license.html' },
    stem_batch07_scott_buckley_solace: { sourceSnapshot: 'docs/license-snapshots/batch-07/scott-buckley-solace.source.html', licenseSnapshot: 'docs/license-snapshots/batch-07/cc-by-4-0.license.html' },
    stem_commons_pine_forest_wind: { sourceSnapshot: 'docs/license-snapshots/batch-08/commons-wind-pine-forest.source.html' },
    stem_batch09_room_apartment_small: { sourceSnapshot: 'docs/license-snapshots/batch-09/room_apartment_small.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc0-1.0.license.html' },
    stem_batch09_room_bedroom_night: { sourceSnapshot: 'docs/license-snapshots/batch-09/room_bedroom_night.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc0-1.0.license.html' },
    stem_batch09_room_office_distant_traffic: { sourceSnapshot: 'docs/license-snapshots/batch-09/room_office_distant_traffic.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc0-1.0.license.html' },
    stem_batch09_fan_deep_ventilation: { sourceSnapshot: 'docs/license-snapshots/batch-09/fan_deep_ventilation.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc0-1.0.license.html' },
    stem_batch09_fan_mine_ventilation: { sourceSnapshot: 'docs/license-snapshots/batch-09/fan_mine_ventilation.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc-by-4.0.license.html' },
    stem_batch09_train_taiwan_ep727: { sourceSnapshot: 'docs/license-snapshots/batch-09/train_taiwan_ep727.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc0-1.0.license.html' },
    stem_batch09_air_conditioner_hum_1: { sourceSnapshot: 'docs/license-snapshots/batch-09/air_conditioner_hum_1.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc-by-4.0.license.html' },
    stem_batch09_air_conditioner_hum_2: { sourceSnapshot: 'docs/license-snapshots/batch-09/air_conditioner_hum_2.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc-by-4.0.license.html' },
    stem_supply_gap_02_aircraft_cabin_csnmedia_381174: { sourceSnapshot: 'docs/license-snapshots/supply-gap-batch-02/freesound-381174.source.html', licenseSnapshot: 'docs/license-snapshots/supply-gap-batch-02/cc0-1.0.license.html' },
    stem_supply_gap_02_airbus_a330_cabin_fillsoko_456092: { sourceSnapshot: 'docs/license-snapshots/supply-gap-batch-02/freesound-456092.source.html', licenseSnapshot: 'docs/license-snapshots/supply-gap-batch-02/cc0-1.0.license.html' },
    stem_supply_gap_02_train_taiwan_all_night_variant: { sourceSnapshot: 'docs/license-snapshots/batch-09/train_taiwan_ep727.source.html', licenseSnapshot: 'docs/license-snapshots/batch-09/cc0-1.0.license.html' },
    stem_b05_commons_001: { sourceSnapshot: 'docs/license-snapshots/batch-05/singingbowl1.source.html', licenseSnapshot: 'docs/license-snapshots/batch-05/public-domain.license.html' },
    stem_b05_commons_002: { sourceSnapshot: 'docs/license-snapshots/batch-05/singingbowl2.source.html', licenseSnapshot: 'docs/license-snapshots/batch-05/public-domain.license.html' },
    stem_b05_commons_004: { sourceSnapshot: 'docs/license-snapshots/batch-05/synthetic_bell_sound.source.html', licenseSnapshot: 'docs/license-snapshots/batch-05/cc0-1.0.license.html' },
  };
  const match = specific[stem.id];
  return match
    ? { mode: 'source_and_license_snapshot', sourceSnapshot: match.sourceSnapshot, licenseSnapshot: match.licenseSnapshot ?? match.sourceSnapshot }
    : { mode: 'missing', sourceSnapshot: null, licenseSnapshot: null };
};

const inspectAudio = (filePath: string) => {
  const output = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate,channels,codec_name:format=duration',
    '-of', 'json', filePath,
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(output);
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    sampleRate: Number(parsed.streams?.[0]?.sample_rate ?? 0),
    channels: Number(parsed.streams?.[0]?.channels ?? 0),
    codec: String(parsed.streams?.[0]?.codec_name ?? ''),
  };
};

const run = async () => {
  const [stemResult, conceptResult] = await Promise.all([
    query<ReleaseStemRow>(
      `select s.id, s.name, s.category, s.audio_url, s.tags, s.default_volume,
         s.source_platform, s.source_url, s.source_item_id, s.source_creator,
         s.license_name, s.license_url, s.attribution_required,
         s.raw_redistribution_allowed, s.file_sha256, s.qa_notes,
         f.duration_seconds, f.sample_rate, f.channels, f.integrated_lufs,
         f.true_peak_db, f.analysis_version,
         m.metadata_version, m.semantic_descriptions, m.roles, m.goal_fit,
         m.temporal_profile, m.mix_profile, m.risks, m.review
       from audio_stems s
       join stem_acoustic_features f on f.stem_id = s.id
       join stem_metadata_v3 m on m.stem_id = s.id and m.metadata_version = 3
       where s.qa_status = 'approved'
         and s.commercial_use_allowed is true
         and s.derivative_use_allowed is true
       order by s.category, s.name, s.id`,
    ),
    query<{ stem_id: string; concepts: string[] }>(
      `select stem_id, array_agg(distinct concept_id order by concept_id) as concepts
       from stem_concepts where verified is true group by stem_id`,
    ),
  ]);
  const conceptsByStem = new Map(conceptResult.rows.map((row) => [row.stem_id, row.concepts]));
  const failures: Array<{ stemId?: string; gate: string; detail: string }> = [];
  const items = [];

  if (stemResult.rows.length !== expectedReleaseStemCount) {
    failures.push({ gate: 'release_count', detail: `Expected ${expectedReleaseStemCount}, received ${stemResult.rows.length}.` });
  }

  for (const stem of stemResult.rows) {
    const concepts = conceptsByStem.get(stem.id) ?? [];
    const rightsEvidence = evidenceForStem(stem);
    const relativeAudioPath = stem.audio_url.replace(/^\//, '');
    const absoluteAudioPath = path.join(root, 'public', relativeAudioPath);
    let physical: ReturnType<typeof inspectAudio> | null = null;
    let actualSha256: string | null = null;
    try {
      await access(absoluteAudioPath);
      const bytes = await readFile(absoluteAudioPath);
      actualSha256 = createHash('sha256').update(bytes).digest('hex');
      physical = inspectAudio(absoluteAudioPath);
    } catch (error) {
      failures.push({ stemId: stem.id, gate: 'playable_file', detail: error instanceof Error ? error.message : String(error) });
    }

    const requiredText = [
      ['source_platform', stem.source_platform],
      ['source_url', stem.source_url],
      ['source_item_id', stem.source_item_id],
      ['source_creator', stem.source_creator],
      ['license_name', stem.license_name],
      ['license_url', stem.license_url],
      ['file_sha256', stem.file_sha256],
      ['qa_notes', stem.qa_notes],
    ] as const;
    for (const [field, value] of requiredText) {
      if (!value || value === 'Unknown') failures.push({ stemId: stem.id, gate: 'rights_metadata', detail: `${field} is missing.` });
    }
    if (actualSha256 && actualSha256 !== stem.file_sha256) {
      failures.push({ stemId: stem.id, gate: 'hash', detail: `Expected ${stem.file_sha256}, received ${actualSha256}.` });
    }
    if (physical && (
      Math.abs(physical.durationSeconds - Number(stem.duration_seconds)) > 0.5
      || physical.sampleRate !== Number(stem.sample_rate)
      || physical.channels !== Number(stem.channels)
    )) {
      failures.push({
        stemId: stem.id,
        gate: 'probe',
        detail: `Database ${stem.duration_seconds}s/${stem.sample_rate}Hz/${stem.channels}ch vs file ${physical.durationSeconds}s/${physical.sampleRate}Hz/${physical.channels}ch.`,
      });
    }
    if (stem.category === 'Voice' || concepts.some((concept) => concept === 'source.human.voice' || concept.startsWith('source.human.voice.'))) {
      failures.push({ stemId: stem.id, gate: 'voice_free', detail: 'Release pool contains a Voice category or human-voice concept.' });
    }
    if (!stem.semantic_descriptions.length || !stem.roles.length || !stem.review?.status) {
      failures.push({ stemId: stem.id, gate: 'metadata_v3', detail: 'Semantic description, role, or review status is missing.' });
    }
    if (rightsEvidence.mode === 'missing') {
      failures.push({ stemId: stem.id, gate: 'rights_evidence', detail: 'No local or project-owned rights evidence mapping exists.' });
    }
    for (const evidencePath of [rightsEvidence.sourceSnapshot, rightsEvidence.licenseSnapshot].filter((value): value is string => Boolean(value))) {
      try {
        await access(path.join(root, evidencePath));
      } catch {
        failures.push({ stemId: stem.id, gate: 'rights_evidence', detail: `Missing ${evidencePath}.` });
      }
    }

    items.push({
      id: stem.id,
      name: stem.name,
      category: stem.category,
      audioUrl: stem.audio_url,
      fileSha256: stem.file_sha256,
      physical,
      acoustic: {
        analysisVersion: stem.analysis_version,
        durationSeconds: Number(stem.duration_seconds),
        sampleRate: Number(stem.sample_rate),
        channels: Number(stem.channels),
        integratedLufs: stem.integrated_lufs === null ? null : Number(stem.integrated_lufs),
        truePeakDb: stem.true_peak_db === null ? null : Number(stem.true_peak_db),
      },
      source: {
        platform: stem.source_platform,
        itemId: stem.source_item_id,
        creator: stem.source_creator,
        url: stem.source_url,
      },
      license: {
        name: stem.license_name,
        url: stem.license_url,
        attributionRequired: stem.attribution_required,
        rawRedistributionAllowed: stem.raw_redistribution_allowed,
      },
      rightsEvidence,
      metadataV3: {
        version: stem.metadata_version,
        roles: stem.roles,
        concepts,
        semanticDescriptions: stem.semantic_descriptions,
        review: stem.review,
      },
      tags: stem.tags,
      defaultVolume: stem.default_volume,
    });
  }

  const coverage = JSON.parse(await readFile(path.join(root, `reports/effective-content-coverage-v3-${date}.json`), 'utf8'));
  if (coverage.summary?.covered !== 16 || coverage.summary?.partial !== 0 || coverage.summary?.gap !== 0) {
    failures.push({ gate: 'content_coverage', detail: `Expected 16/0/0, received ${coverage.summary?.covered}/${coverage.summary?.partial}/${coverage.summary?.gap}.` });
  }
  const assetAudit = JSON.parse(await readFile(path.join(root, 'reports/asset-audit.json'), 'utf8'));
  if (assetAudit.totals?.approvedFilesMissing !== 0 || assetAudit.totals?.hashMismatches !== 0) {
    failures.push({ gate: 'asset_audit', detail: 'Approved files are missing or have hash mismatches.' });
  }

  const categoryCounts = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, {});
  const evidenceCounts = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.rightsEvidence.mode] = (counts[item.rightsEvidence.mode] ?? 0) + 1;
    return counts;
  }, {});
  const licenseCounts = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.license.name] = (counts[item.license.name] ?? 0) + 1;
    return counts;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    releaseChannel: 'voice-free-beta',
    status: failures.length === 0 ? 'pass' : 'blocked',
    releasePoolDefinition: "qa_status=approved AND commercial_use_allowed=true AND derivative_use_allowed=true, with acoustic and V3 metadata rows.",
    counts: {
      releaseStems: items.length,
      categories: categoryCounts,
      rightsEvidence: evidenceCounts,
      licenses: licenseCounts,
      contentCoverage: coverage.summary,
    },
    gates: {
      physicalFilesPresent: !failures.some((item) => item.gate === 'playable_file'),
      hashesMatch: !failures.some((item) => item.gate === 'hash'),
      probesMatch: !failures.some((item) => item.gate === 'probe'),
      rightsMetadataComplete: !failures.some((item) => item.gate === 'rights_metadata'),
      rightsEvidenceComplete: !failures.some((item) => item.gate === 'rights_evidence'),
      v3MetadataComplete: !failures.some((item) => item.gate === 'metadata_v3'),
      voiceFree: !failures.some((item) => item.gate === 'voice_free'),
      effectiveCoverageComplete: !failures.some((item) => item.gate === 'content_coverage'),
      approvedAssetAuditClean: !failures.some((item) => item.gate === 'asset_audit'),
    },
    nonReleaseScope: {
      unregisteredAudioFiles: assetAudit.totals?.unregisteredFiles,
      explanation: 'Candidate downloads, listening previews, loop masters, rendered QA combinations, and other intermediate files are intentionally outside the approved release pool.',
      rejectedOrPendingDatabaseStems: Number(assetAudit.totals?.databaseStems ?? 0) - items.length,
    },
    failures,
    items,
  };
  await writeFile(path.join(root, `reports/content-release-manifest-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    '# Voice-free Beta Content Release Manifest',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: **${report.status}**`,
    '',
    `- Release Stems: ${report.counts.releaseStems}`,
    `- Categories: ${Object.entries(categoryCounts).map(([key, value]) => `${key} ${value}`).join(', ')}`,
    `- Effective coverage: ${coverage.summary.covered} covered / ${coverage.summary.partial} partial / ${coverage.summary.gap} gap`,
    `- Rights evidence: ${Object.entries(evidenceCounts).map(([key, value]) => `${key} ${value}`).join(', ')}`,
    `- Files outside release pool: ${report.nonReleaseScope.unregisteredAudioFiles} candidate/QA/intermediate audio files`,
    '',
    '## Gates',
    '',
    ...Object.entries(report.gates).map(([key, passed]) => `- ${passed ? 'PASS' : 'FAIL'} ${key}`),
    '',
    '## Boundary',
    '',
    'The release pool contains approved non-Voice ingredients only. Candidate downloads, listening previews, loop masters, rendered QA combinations, rejected stems, and needs-review Voice/TTS items are not release assets.',
    '',
    '## Failures',
    '',
    ...(failures.length ? failures.map((item) => `- ${item.stemId ?? 'release'} / ${item.gate}: ${item.detail}`) : ['- None']),
    '',
    'The JSON manifest contains the complete per-Stem source, license, rights-evidence, hash, probe, acoustic, and V3 metadata record.',
    '',
  ];
  await writeFile(path.join(root, `reports/content-release-manifest-${date}.md`), lines.join('\n'));
  console.log(JSON.stringify({ status: report.status, counts: report.counts, gates: report.gates, failures: report.failures }, null, 2));
  if (failures.length) process.exitCode = 1;
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
