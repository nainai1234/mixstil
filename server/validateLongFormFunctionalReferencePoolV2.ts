import { readFileSync } from 'node:fs';

const pool = JSON.parse(readFileSync(new URL('../config/long-form-functional-reference-pool-v2.json', import.meta.url), 'utf8'));
const fail = (message: string): never => { throw new Error(`Long-form reference pool validation failed: ${message}`); };
if (pool.references.length !== 24) fail(`expected 24 references, got ${pool.references.length}`);
const counts = { sleep: 0, calm: 0, focus: 0 } as Record<string, number>;
const ids = new Set<string>();
for (const item of pool.references) {
  if (ids.has(item.id)) fail(`duplicate id ${item.id}`);
  ids.add(item.id);
  if (!(item.goal in counts)) fail(`unsupported goal ${item.goal}`);
  counts[item.goal] += 1;
  const minimum = item.goal === 'focus' ? pool.durationPolicy.focusMinimumSeconds : item.goal === 'sleep' ? pool.durationPolicy.sleepMinimumSeconds : pool.durationPolicy.calmMinimumSeconds;
  if (item.durationSeconds < minimum) fail(`${item.id} is below ${minimum}s`);
  if (!item.sourceUrl || !item.creator || !item.title) fail(`${item.id} is missing source identity`);
}
if (counts.sleep !== 8 || counts.calm !== 8 || counts.focus !== 8) fail(`goal distribution is ${JSON.stringify(counts)}`);
console.log(`PASS: 24 long-form references validated (Sleep ${counts.sleep}, Calm ${counts.calm}, Focus ${counts.focus}); browser listening and voice-free QA remain pending.`);
