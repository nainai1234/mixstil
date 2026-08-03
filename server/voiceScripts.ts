import type { ProductScene } from './contentCatalog';

export type VoiceScriptBlock = {
  id: string;
  scene: Exclude<ProductScene, 'deep_focus'>;
  language: 'en' | 'zh';
  role: 'permission' | 'settling' | 'practice' | 'release';
  text: string;
  pauseAfterSeconds: number;
};

export const voiceScriptBlocks: VoiceScriptBlock[] = [
  { id: 'bedtime-en-permission', scene: 'bedtime', language: 'en', role: 'permission', text: 'Let yourself settle in. You can adjust your position whenever you need.', pauseAfterSeconds: 5 },
  { id: 'bedtime-en-settling', scene: 'bedtime', language: 'en', role: 'settling', text: 'Notice the support beneath you, and allow your breathing to remain easy and natural.', pauseAfterSeconds: 12 },
  { id: 'bedtime-zh-permission', scene: 'bedtime', language: 'zh', role: 'permission', text: '让自己慢慢安顿下来。任何时候觉得不舒服，都可以调整姿势。', pauseAfterSeconds: 5 },
  { id: 'bedtime-zh-settling', scene: 'bedtime', language: 'zh', role: 'settling', text: '感受身体下方的支撑，让呼吸保持轻松自然。', pauseAfterSeconds: 12 },
  { id: 'return-en-settling', scene: 'return_to_sleep', language: 'en', role: 'settling', text: 'There is nothing you need to solve right now. Simply notice one quiet breath at a time.', pauseAfterSeconds: 12 },
  { id: 'return-zh-settling', scene: 'return_to_sleep', language: 'zh', role: 'settling', text: '现在没有什么必须解决。只需要留意一次又一次安静的呼吸。', pauseAfterSeconds: 12 },
  { id: 'breathing-en-practice', scene: 'breathing', language: 'en', role: 'practice', text: 'Breathe in gently, and let the out-breath take its own time. Never force or hold the breath.', pauseAfterSeconds: 8 },
  { id: 'breathing-zh-practice', scene: 'breathing', language: 'zh', role: 'practice', text: '轻轻吸气，让呼气自然地完成。不要勉强，也不需要屏住呼吸。', pauseAfterSeconds: 8 },
  { id: 'settling-en-release', scene: 'emotional_settling', language: 'en', role: 'release', text: 'Make room for this moment without needing to name or change it.', pauseAfterSeconds: 12 },
  { id: 'settling-zh-release', scene: 'emotional_settling', language: 'zh', role: 'release', text: '给此刻留出一点空间，不必急着命名，也不必马上改变。', pauseAfterSeconds: 12 },
];

const prohibitedVoicePatterns = [
  /cure|treat|guaranteed|diagnos|trauma release|you will obey|cannot wake/i,
  /治愈|治疗|保证|诊断|清除创伤|必须服从|无法醒来/,
];

export const validateVoiceScriptBlocks = () => voiceScriptBlocks.flatMap((block) => {
  const errors: string[] = [];
  if (prohibitedVoicePatterns.some((pattern) => pattern.test(block.text))) errors.push(`${block.id}: prohibited expression`);
  if (block.pauseAfterSeconds < 3) errors.push(`${block.id}: pause is too short`);
  return errors;
});

export const selectVoiceScript = (scene: ProductScene, language: 'en' | 'zh') =>
  voiceScriptBlocks.filter((block) => block.scene === scene && block.language === language);

