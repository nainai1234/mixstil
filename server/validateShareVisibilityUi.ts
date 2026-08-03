import { readFile } from 'node:fs/promises';

const source = await readFile('src/components/ShareVisibilityDialog.tsx', 'utf8');
const failures: string[] = [];

if (!source.includes("onClick={() => createShare('public')}")) {
  failures.push('The share dialog does not expose the public-share action.');
}
if (!source.includes("onClick={() => createShare('unlisted')}")) {
  failures.push('The share dialog does not expose the private-share action.');
}
if (source.includes('!isPrivateWork && <button')) {
  failures.push('The public-share action is hidden for private Works.');
}
if (!source.includes("visibility === 'public' && isPrivateWork")) {
  failures.push('A private Work is not promoted before creating a public share.');
}
if (!source.includes("await api.updateMix(mix.id, { status: 'published' })")) {
  failures.push('The public-share promotion does not persist published visibility.');
}

if (failures.length) throw new Error(`Share visibility UI validation failed:\n- ${failures.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  choices: ['public', 'private'],
  privateWorkPublicSharePromotesVisibility: true,
}, null, 2));
