import fs from 'node:fs';
import path from 'node:path';

type FinishedBrief = {
  id: string;
  title: string;
  goal: 'sleep' | 'calm' | 'focus';
  scene: string;
  durationMinutes: number;
  structure: string;
  audibleIdentity: string;
  replayReason: string;
  ingredientsNeeded: string[];
  avoid: string[];
};

type SoundGap = {
  id: string;
  family: string;
  scene: string;
  role: string;
  brief: string;
};

const root = process.cwd();
const finishedPath = path.join(root, 'data/content-baseline/finished-content-briefs-v1.json');
const gapsPath = path.join(root, 'data/content-baseline/foundational-sound-gaps-v1.json');
const finished = JSON.parse(fs.readFileSync(finishedPath, 'utf8')) as { briefs: FinishedBrief[] };
const gaps = JSON.parse(fs.readFileSync(gapsPath, 'utf8')) as { gaps: SoundGap[] };

const failures: string[] = [];

const assert = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const uniqueCount = (values: string[]) => new Set(values).size;
const countBy = <T extends string>(values: T[]) => values.reduce<Record<T, number>>((counts, value) => {
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {} as Record<T, number>);

assert(finished.briefs.length === 30, 'finished content brief count must be 30');
assert(uniqueCount(finished.briefs.map((item) => item.id)) === finished.briefs.length, 'finished content IDs must be unique');
assert(uniqueCount(finished.briefs.map((item) => item.title)) === finished.briefs.length, 'finished content titles must be unique');

const finishedGoals = countBy(finished.briefs.map((item) => item.goal));
assert(finishedGoals.sleep === 10, 'finished content must include 10 sleep briefs');
assert(finishedGoals.calm === 10, 'finished content must include 10 calm briefs');
assert(finishedGoals.focus === 10, 'finished content must include 10 focus briefs');

for (const brief of finished.briefs) {
  assert(brief.title.trim().length >= 6, `${brief.id} must have a real title`);
  assert(brief.durationMinutes >= 10, `${brief.id} must be at least 10 minutes`);
  assert(brief.structure.trim().length >= 24, `${brief.id} must describe structure`);
  assert(brief.audibleIdentity.trim().length >= 12, `${brief.id} must define audible identity`);
  assert(brief.replayReason.trim().length >= 20, `${brief.id} must define replay reason`);
  assert(brief.ingredientsNeeded.length >= 2, `${brief.id} must list at least two needed ingredients`);
  assert(brief.avoid.length >= 3, `${brief.id} must list at least three avoid rules`);
}

assert(gaps.gaps.length === 100, 'foundational sound gap count must be 100');
assert(uniqueCount(gaps.gaps.map((item) => item.id)) === gaps.gaps.length, 'foundational sound gap IDs must be unique');

const requiredFamilies = [
  'sleep_bed',
  'sleep_music',
  'calm_music',
  'calm_environment',
  'focus_bed',
  'focus_music',
  'accent',
];
const gapFamilies = countBy(gaps.gaps.map((item) => item.family));
for (const family of requiredFamilies) {
  assert((gapFamilies[family] ?? 0) > 0, `foundational gaps must include ${family}`);
}

for (const gap of gaps.gaps) {
  assert(gap.id.startsWith(`${gap.family}_`) || gap.family === 'accent', `${gap.id} should be grouped by family`);
  assert(gap.scene.trim().length > 0, `${gap.id} must include scene`);
  assert(gap.role.trim().length > 0, `${gap.id} must include role`);
  assert(gap.brief.trim().length >= 24, `${gap.id} must include a concrete production brief`);
}

if (failures.length) {
  throw new Error(`Content baseline batch 001 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  finishedContentBriefs: finished.briefs.length,
  finishedContentByGoal: finishedGoals,
  foundationalSoundGaps: gaps.gaps.length,
  foundationalSoundGapsByFamily: gapFamilies,
  files: [
    'data/content-baseline/finished-content-briefs-v1.json',
    'data/content-baseline/foundational-sound-gaps-v1.json',
  ],
}, null, 2));
