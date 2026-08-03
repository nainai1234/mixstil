import { query } from './db';

export const AUDIO_INTENT_GOLD_SET_VERSION = 2;

type GoldSeed = {
  id: string;
  language: 'zh' | 'en';
  prompt: string;
  goal: 'sleep' | 'calm' | 'focus';
  scene: 'bedtime' | 'return_to_sleep' | 'breathing' | 'emotional_settling' | 'deep_focus';
  contentMode: 'pure_soundscape' | 'functional_music' | 'sound_journey' | 'guided_meditation';
  include: string[];
  exclude: string[];
  arc?: string[];
};

const zh = (id: string, prompt: string, goal: GoldSeed['goal'], scene: GoldSeed['scene'], contentMode: GoldSeed['contentMode'], include: string[] = [], exclude: string[] = [], arc?: string[]): GoldSeed => ({ id, language: 'zh', prompt, goal, scene, contentMode, include, exclude, arc });
const en = (id: string, prompt: string, goal: GoldSeed['goal'], scene: GoldSeed['scene'], contentMode: GoldSeed['contentMode'], include: string[] = [], exclude: string[] = [], arc?: string[]): GoldSeed => ({ id, language: 'en', prompt, goal, scene, contentMode, include, exclude, arc });

export const goldSemanticSeeds: GoldSeed[] = [
  zh('zh_sleep_rain', '睡前只要轻柔稳定的雨声，不要雷声、音乐和人声。', 'sleep', 'bedtime', 'pure_soundscape', ['source.natural.water.rain'], ['source.natural.thunder', 'source.music', 'source.human.voice']),
  zh('zh_sleep_no_water', '睡前不要任何水声，只要很轻的室内底噪。', 'sleep', 'bedtime', 'pure_soundscape', ['source.domestic.room_tone'], ['source.natural.water']),
  zh('zh_sleep_fan', '想听低速风扇帮助入睡，不要音乐。', 'sleep', 'bedtime', 'pure_soundscape', ['source.domestic.fan'], ['source.music']),
  zh('zh_sleep_need_noise_low', '晚上睡不好觉，但是又不想听音乐，白噪音也不能声音太大。', 'sleep', 'bedtime', 'pure_soundscape', ['source.noise.white'], ['source.music'], ['low_intensity']),
  zh('zh_sleep_music_dry', '给我干爽的温暖助眠音乐，不要雨、海浪和其他自然声。', 'sleep', 'bedtime', 'functional_music', ['source.music'], ['source.natural.water', 'source.natural.forest']),
  zh('zh_sleep_music_late', '先用安静底噪让我稳定下来，五分钟后再进入温暖音乐，不要水声。', 'sleep', 'bedtime', 'sound_journey', ['role.base.masking', 'source.music'], ['source.natural.water'], ['base_first', 'music_later']),
  zh('zh_return_room', '我半夜醒了，只要稳定房间声帮助回睡，不要水声和旋律。', 'sleep', 'return_to_sleep', 'pure_soundscape', ['source.domestic.room_tone'], ['source.natural.water', 'source.music']),
  zh('zh_return_fan', '夜醒后播放低风扇声，持续稳定，不要突然变化。', 'sleep', 'return_to_sleep', 'pure_soundscape', ['source.domestic.fan'], [], ['steady']),
  zh('zh_return_guided', '夜醒后给我几句中文轻声引导，然后人声退出，背景保持安静。', 'sleep', 'return_to_sleep', 'guided_meditation', ['source.human.voice', 'role.base.masking'], [], ['voice_first', 'voice_exit']),
  zh('zh_breathing_guided', '做十分钟中文呼吸冥想，短句、长停顿、轻柔人声。', 'calm', 'breathing', 'guided_meditation', ['source.human.voice'], [], ['voice_sparse']),
  zh('zh_breathing_chime', '呼吸练习只要很轻的底噪，开始时一次柔和钟声，不要音乐。', 'calm', 'breathing', 'pure_soundscape', ['role.base.masking', 'source.accent.chime'], ['source.music'], ['single_chime']),
  zh('zh_calm_forest', '下班后想听安静森林让我平静，不要鸟叫、水声和音乐。', 'calm', 'emotional_settling', 'pure_soundscape', ['source.natural.forest'], ['source.animal.bird', 'source.natural.water', 'source.music']),
  zh('zh_calm_indoor', '让我慢慢平静下来，只要室内房间底噪，不要自然声。', 'calm', 'emotional_settling', 'pure_soundscape', ['source.domestic.room_tone'], ['source.natural']),
  zh('zh_calm_music', '给我温暖但变化很少的放松音乐，不要人声和水声。', 'calm', 'emotional_settling', 'functional_music', ['source.music'], ['source.human.voice', 'source.natural.water']),
  zh('zh_calm_journey', '先听到很轻的森林环境，之后逐步进入温暖音乐，最后只留下底噪。', 'calm', 'emotional_settling', 'sound_journey', ['source.natural.forest', 'source.music', 'role.base.masking'], [], ['environment_first', 'music_later', 'base_release']),
  zh('zh_focus_train', '列车车厢和轻微室内底噪帮助专注，不要雨水和音乐。', 'focus', 'deep_focus', 'pure_soundscape', ['source.vehicle.rail.carriage', 'source.domestic.room_tone'], ['source.natural.water.rain', 'source.music']),
  zh('zh_focus_room', '专注工作只要办公室房间声，声音要低而稳定。', 'focus', 'deep_focus', 'pure_soundscape', ['source.domestic.room_tone'], [], ['steady']),
  zh('zh_focus_music', '低音量、少变化的专注音乐，不要人声和任何自然声。', 'focus', 'deep_focus', 'functional_music', ['source.music'], ['source.human.voice', 'source.natural']),
  zh('zh_focus_rain', '阅读时想听很轻的雨声，不要雷、鸟叫和旋律。', 'focus', 'deep_focus', 'pure_soundscape', ['source.natural.water.rain'], ['source.natural.thunder', 'source.animal.bird', 'source.music']),
  zh('zh_focus_late_music', '先用安静办公室底噪进入状态，之后音乐很慢地出现。', 'focus', 'deep_focus', 'sound_journey', ['source.domestic.room_tone', 'source.music'], [], ['base_first', 'music_later']),
  zh('zh_conflict', '不要音乐，但希望五分钟后钢琴进入。', 'sleep', 'bedtime', 'sound_journey', ['source.music.piano'], ['source.music'], ['clarification_required']),
  en('en_sleep_rain', 'For bedtime, use only soft steady rain. No thunder, music, or voice.', 'sleep', 'bedtime', 'pure_soundscape', ['source.natural.water.rain'], ['source.natural.thunder', 'source.music', 'source.human.voice']),
  en('en_sleep_no_water', 'I need a quiet indoor bed for sleep with no water sounds at all.', 'sleep', 'bedtime', 'pure_soundscape', ['source.domestic.room_tone'], ['source.natural.water']),
  en('en_sleep_fan', 'A low bedroom fan for sleep, steady and without melody.', 'sleep', 'bedtime', 'pure_soundscape', ['source.domestic.fan'], ['source.music']),
  en('en_sleep_need_noise_low', "I haven't been sleeping well. I don't want music, and the white noise shouldn't be loud.", 'sleep', 'bedtime', 'pure_soundscape', ['source.noise.white'], ['source.music'], ['low_intensity']),
  en('en_sleep_music_dry', 'Warm dry sleep music with no rain, ocean, river, or birds.', 'sleep', 'bedtime', 'functional_music', ['source.music'], ['source.natural.water', 'source.animal.bird']),
  en('en_sleep_music_late', 'Start with a quiet neutral bed, then bring warm music in after five minutes. No water.', 'sleep', 'bedtime', 'sound_journey', ['role.base.masking', 'source.music'], ['source.natural.water'], ['base_first', 'music_later']),
  en('en_return_room', 'I woke during the night. Use only quiet room tone to help me return to sleep, no melody.', 'sleep', 'return_to_sleep', 'pure_soundscape', ['source.domestic.room_tone'], ['source.music']),
  en('en_return_fan', 'After waking at night, play a low fan with no sudden changes.', 'sleep', 'return_to_sleep', 'pure_soundscape', ['source.domestic.fan'], [], ['steady']),
  en('en_return_guided', 'Give me two or three gentle English prompts, then let the voice leave while the background continues.', 'sleep', 'return_to_sleep', 'guided_meditation', ['source.human.voice', 'role.base.masking'], [], ['voice_first', 'voice_exit']),
  en('en_breathing_guided', 'A ten-minute guided breathing meditation with short English phrases and long pauses.', 'calm', 'breathing', 'guided_meditation', ['source.human.voice'], [], ['voice_sparse']),
  en('en_breathing_chime', 'Quiet masking noise for breathing with one soft chime at the beginning, no music.', 'calm', 'breathing', 'pure_soundscape', ['role.base.masking', 'source.accent.chime'], ['source.music'], ['single_chime']),
  en('en_calm_forest', 'Help me settle after work with a quiet forest, but no birds, water, or music.', 'calm', 'emotional_settling', 'pure_soundscape', ['source.natural.forest'], ['source.animal.bird', 'source.natural.water', 'source.music']),
  en('en_calm_indoor', 'Use only soft indoor room ambience to help me settle, no nature sounds.', 'calm', 'emotional_settling', 'pure_soundscape', ['source.domestic.room_tone'], ['source.natural']),
  en('en_calm_music', 'Warm low-variation relaxation music with no voice and no water.', 'calm', 'emotional_settling', 'functional_music', ['source.music'], ['source.human.voice', 'source.natural.water']),
  en('en_calm_journey', 'Begin in a quiet forest, gradually enter warm music, and release into a neutral background.', 'calm', 'emotional_settling', 'sound_journey', ['source.natural.forest', 'source.music', 'role.base.masking'], [], ['environment_first', 'music_later', 'base_release']),
  en('en_focus_train', 'Train carriage and subtle indoor noise for focus, without rain or music.', 'focus', 'deep_focus', 'pure_soundscape', ['source.vehicle.rail.carriage', 'source.domestic.room_tone'], ['source.natural.water.rain', 'source.music']),
  en('en_focus_room', 'Only a low steady office room tone for deep work.', 'focus', 'deep_focus', 'pure_soundscape', ['source.domestic.room_tone'], [], ['steady']),
  en('en_focus_music', 'Low-volume, low-variation focus music with no voice or nature sounds.', 'focus', 'deep_focus', 'functional_music', ['source.music'], ['source.human.voice', 'source.natural']),
  en('en_focus_rain', 'Very light rain for reading, with no thunder, birds, or melody.', 'focus', 'deep_focus', 'pure_soundscape', ['source.natural.water.rain'], ['source.natural.thunder', 'source.animal.bird', 'source.music']),
  en('en_focus_late_music', 'Start with quiet office ambience and let the music arrive slowly later.', 'focus', 'deep_focus', 'sound_journey', ['source.domestic.room_tone', 'source.music'], [], ['base_first', 'music_later']),
  en('en_conflict', 'No music, but bring in soft piano after five minutes.', 'sleep', 'bedtime', 'sound_journey', ['source.music.piano'], ['source.music'], ['clarification_required']),
];

const variants = {
  zh: ['', '声音保持轻柔。', '我会戴耳机听。', '请避免突然变响。', '这是语音输入的需求。'],
  en: ['', 'Keep the overall level gentle.', 'I will listen on headphones.', 'Avoid sudden loud changes.', 'This request came from voice input.'],
} as const;

export const audioIntentGoldCases = goldSemanticSeeds.flatMap((seed) => variants[seed.language].map((suffix, index) => ({
  id: `gold_v${AUDIO_INTENT_GOLD_SET_VERSION}_${seed.id}_${index + 1}`,
  language: seed.language,
  prompt: `${seed.prompt}${suffix ? ` ${suffix}` : ''}`,
  semanticGroup: seed.id,
  expectedIntent: {
    schemaVersion: 3,
    goal: seed.goal,
    scene: seed.scene,
    contentMode: seed.contentMode,
    include: seed.include,
    exclude: seed.exclude,
    narrativeArc: seed.arc ?? [],
    clarificationNeeded: seed.arc?.includes('clarification_required') ?? false,
  },
})));

export const seedAudioIntentGoldSetV3 = async () => {
  for (const item of audioIntentGoldCases) {
    await query(
      `insert into audio_intent_gold_cases (id, set_version, language, prompt, expected_intent, semantic_group, review_status)
       values ($1, $2, $3, $4, $5, $6, 'seed_reviewed')
       on conflict (id) do update set set_version = excluded.set_version, language = excluded.language,
         prompt = excluded.prompt, expected_intent = excluded.expected_intent,
         semantic_group = excluded.semantic_group, review_status = excluded.review_status, updated_at = now()`,
      [item.id, AUDIO_INTENT_GOLD_SET_VERSION, item.language, item.prompt, JSON.stringify(item.expectedIntent), item.semanticGroup],
    );
  }
};
