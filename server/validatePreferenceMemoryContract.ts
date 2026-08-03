import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, 'server/schema.ts'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
const planner = fs.readFileSync(path.join(root, 'server/soundscapePlanner.ts'), 'utf8');
const recipe = fs.readFileSync(path.join(root, 'server/recipeV2.ts'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'src/pages/ProfilePage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const domain = fs.readFileSync(path.join(root, 'src/lib/domain.ts'), 'utf8');
const createPage = fs.readFileSync(path.join(root, 'src/pages/AIHealPage.tsx'), 'utf8');

const requirements = [
  [schema, 'create table if not exists user_sound_profiles', 'sound profile table exists'],
  [schema, 'create table if not exists preference_evidence', 'preference evidence table exists'],
  [server, "app.get('/api/me/sound-profile'", 'sound profile GET endpoint exists'],
  [server, "app.put('/api/me/sound-profile'", 'sound profile PUT endpoint exists'],
  [server, "app.delete('/api/me/preference-evidence/:id'", 'learned preference delete endpoint exists'],
  [server, 'ensureSoundProfile', 'profile row is created on demand'],
  [server, 'preference_evidence', 'profile changes are recorded as evidence'],
  [server, 'recordSavedInternalBaselinePreference', 'saved baseline preferences are recorded as evidence'],
  [server, 'getSavedInternalBaselinePreferences', 'saved baseline preferences are read before creation'],
  [server, 'savedBaselinePreferences', 'quick create passes saved baseline preferences to selection'],
  [server, 'savedBaselinePreferenceApplied', 'quick create reports when saved baseline preference influenced selection'],
  [server, 'soundProfile:', 'quick create passes sound profile snapshot'],
  [planner, 'stableExcludedSounds', 'planner accepts stable excluded sounds'],
  [planner, 'stableLikedSounds', 'planner accepts stable liked sounds'],
  [planner, 'normalizeLegacySoundList', 'planner normalizes stable sound lists'],
  [recipe, 'soundProfileSnapshot', 'Recipe V2 stores sound profile snapshot'],
  [profile, 'getSoundProfile', 'Profile loads sound profile'],
  [profile, 'updateSoundProfile', 'Profile saves sound profile'],
  [profile, 'Liked sounds', 'Profile exposes liked sounds input'],
  [profile, 'Excluded sounds', 'Profile exposes excluded sounds input'],
  [profile, 'Learned from saved sounds', 'Profile exposes saved-sound learning controls'],
  [profile, 'deletePreferenceEvidence', 'Profile can remove learned saved-sound preferences'],
  [api, 'getSoundProfile', 'API exposes profile read endpoint'],
  [api, 'updateSoundProfile', 'API exposes profile update endpoint'],
  [api, 'deletePreferenceEvidence', 'API exposes learned preference delete endpoint'],
  [api, 'stableExcludedSounds', 'API quickCreate accepts stable excluded sounds'],
  [api, 'stableLikedSounds', 'API quickCreate accepts stable liked sounds'],
  [domain, 'UserSoundProfile', 'domain exposes UserSoundProfile'],
  [domain, 'PreferenceEvidence', 'domain exposes PreferenceEvidence'],
  [createPage, 'stableExcludedSounds', 'Create sends stable excluded sounds'],
  [createPage, 'stableLikedSounds', 'Create sends stable liked sounds'],
] as const;

const missing = requirements
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missing.length) throw new Error(`Preference memory contract failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  contract: 'sprint-2-preference-memory',
  surfaces: ['Profile', 'Create', 'Recipe V2', 'Preference evidence'],
  behavioralSignals: ['saved internal baseline'],
  controls: ['visible saved-sound learning', 'remove learned preference'],
}, null, 2));
