import { readFile } from 'node:fs/promises';

const [player, metadata] = await Promise.all([
  readFile('src/pages/PlayerPage.tsx', 'utf8'),
  readFile('src/pages/WorkMetadata.tsx', 'utf8'),
]);
const failures: string[] = [];

if (player.includes("api.updateMix(mixId, { status: 'private'")) {
  failures.push('Player still forces Save to My Sounds into private visibility.');
}
if (!player.includes("useState<'public' | 'private'>('private')")) {
  failures.push('Player Save to My Sounds flow does not default to private replay.');
}
if (!player.includes("t('player.saveToSounds')") || !player.includes("t('player.saveDialogHelp')")) {
  failures.push('Player does not frame first save as private My Sounds replay.');
}
if (!player.includes("status: access === 'public' ? 'published' : 'private'")) {
  failures.push('Player save visibility is not persisted to the selected access.');
}
if (!player.includes('void api.renderMix(saved.id)')) {
  failures.push('Player save does not start the stable background render.');
}
if (!player.includes("isSavedSound ? t('player.savedToSounds') : t('player.saveToSounds')")) {
  failures.push('Previously saved Works can still be mistaken for new publication actions.');
}
if (!metadata.includes("useState<'public' | 'private'>('public')")) {
  failures.push('Save & Publish does not default to public.');
}
if (metadata.includes('void handleSave(nextAccess);')) {
  failures.push('Save & Publish persists visibility immediately instead of waiting for confirmation.');
}
if (!metadata.includes("publishAccess === 'public' ? 'Publish publicly' : 'Save privately'")) {
  failures.push('Save & Publish does not expose an explicit confirmation action.');
}

if (failures.length) throw new Error(`Publication choice UI validation failed:\n- ${failures.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  defaultAccess: 'private',
  explicitPublicOptIn: true,
  existingSavedWorkVisibilityPreserved: true,
}, null, 2));
