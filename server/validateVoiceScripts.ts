import { selectVoiceScript, validateVoiceScriptBlocks } from './voiceScripts';

const errors = validateVoiceScriptBlocks();
if (errors.length > 0) throw new Error(errors.join('\n'));
for (const scene of ['bedtime', 'return_to_sleep', 'breathing', 'emotional_settling'] as const) {
  for (const language of ['en', 'zh'] as const) {
    if (selectVoiceScript(scene, language).length === 0) throw new Error(`${scene}/${language}: no approved script blocks`);
  }
}
console.log('Controlled voice script validation passed for four scenes in English and Chinese.');

