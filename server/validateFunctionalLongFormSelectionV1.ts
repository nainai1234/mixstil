import { readFileSync } from 'node:fs';

const pool = JSON.parse(readFileSync(new URL('../config/long-form-functional-reference-pool-v2.json', import.meta.url), 'utf8'));
const selection = JSON.parse(readFileSync(new URL('../config/functional-long-form-selection-v1.json', import.meta.url), 'utf8'));
const fail = (message: string): never => { throw new Error(`Functional long-form selection validation failed: ${message}`); };
const byId = new Map(pool.references.map((item: any) => [item.id, item]));
const selectedIds: string[] = [];
for (const [goal, group] of Object.entries(selection.goals) as Array<[string, any]>) {
  if (group.primary.length !== 6 || group.secondary.length !== 2) fail(`${goal} must have 6 primary and 2 secondary references`);
  for (const selected of [...group.primary, ...group.secondary]) {
    const item: any = byId.get(selected.referenceId);
    if (!item) fail(`${goal} references unknown id ${selected.referenceId}`);
    if (item.goal !== group.sourceGoal) fail(`${selected.referenceId} has goal ${item.goal}, expected ${group.sourceGoal}`);
    if (item.durationSeconds < group.minimumDurationSeconds) fail(`${selected.referenceId} is below the ${goal} duration gate`);
    selectedIds.push(selected.referenceId);
  }
}
if (selectedIds.length !== 24 || new Set(selectedIds).size !== 24) fail('all 24 pool references must be assigned exactly once');
console.log('PASS: Meditation, Sleep, and Focus each have 6 primary and 2 secondary long-form references; browser listening QA remains required.');
