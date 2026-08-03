import type { ContentMode, ProductGoal, ProductScene } from './contentCatalog';

export type AudioIntentV2 = {
  schemaVersion: 2;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: ContentMode;
  environmentPreferences: string[];
  excludedSounds: string[];
  intensity: { environment: number; music: number; voice: number };
  qualities: { warmth: number; spaciousness: number; variation: number };
  guidedVoice: { enabled: boolean; language: 'en' | 'zh'; density: 'light' | 'standard' | 'frequent' };
};

const clamp = (value: unknown, fallback = 50) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : fallback));

const detectedGoal = (prompt: string): ProductGoal | null => {
  if (/(focus|study|concentrat|deep work|专注|学习|集中)/i.test(prompt)) return 'focus';
  if (/(sleep|bed|night|nap|insomnia|入睡|睡眠|睡觉|睡不好|睡不着|失眠|难以入睡|睡眠困难|助眠|夜醒|回睡)/i.test(prompt)) return 'sleep';
  if (/(calm|breath|breathe|anxious|stress|settle|冥想|呼吸|焦虑|压力|放松|平静)/i.test(prompt)) return 'calm';
  return null;
};

const defaultScene = (goal: ProductGoal, prompt: string): ProductScene => {
  if (goal === 'sleep') return /(wake|woke|return|back to sleep|夜醒|半夜|回睡|重新入睡)/i.test(prompt) ? 'return_to_sleep' : 'bedtime';
  if (goal === 'calm') return /(breath|breathe|box breathing|呼吸|正念)/i.test(prompt) ? 'breathing' : 'emotional_settling';
  return 'deep_focus';
};

const soundTerms = [
  { id: 'rain', match: /\brain\b|雨/i },
  { id: 'thunder', match: /(storm|thunder|雷)/i },
  { id: 'ocean', match: /(ocean|sea|wave|海|浪)/i },
  { id: 'forest', match: /(forest|woods|树林|森林)/i },
  { id: 'birds', match: /(birds?|birdsong|鸟叫|鸟鸣|鸟声)/i },
  { id: 'fire', match: /(fire|campfire|fireplace|篝火|壁炉|火焰)/i },
  { id: 'wind', match: /(wind|breeze|风声|微风)/i },
  { id: 'crickets', match: /(cricket|insect|蟋蟀|虫鸣|夜间昆虫)/i },
  { id: 'train', match: /(train|carriage|列车|火车|车厢)/i },
  { id: 'aircraft', match: /(aircraft|airplane|plane cabin|aircraft cabin|飞机|客舱|机舱)/i },
  { id: 'indoor', match: /(room tone|indoor|office|fan|air conditioner|室内|房间声|办公室|风扇|空调)/i },
  { id: 'water', match: /(water|river|stream|waterfall|水|河|溪|瀑布)/i },
  { id: 'nature', match: /(nature sounds?|natural sounds?|自然声|大自然声音)/i },
  { id: 'chime', match: /(chime|bell|bowl|钟声|铃声|音钵)/i },
  { id: 'noise', match: /(noise|white noise|pink noise|brown noise|噪音|底噪|白噪|粉噪|棕噪)/i },
];

const exclusionTerms = [
  ...soundTerms,
  { id: 'voice', match: /(voice|speech|spoken|narration|guide|guided|人声|说话|旁白|引导)/i },
  { id: 'music', match: /(music|melody|instrument|音乐|旋律|乐器)/i },
];

const exclusionFamilyExpansion: Record<string, string[]> = {
  water: ['water', 'ocean', 'rain', 'river', 'stream', 'waterfall'],
  ocean: ['ocean', 'water'],
  rain: ['rain', 'water'],
  wind: ['wind'],
  birds: ['birds'],
  voice: ['voice'],
  music: ['music'],
};

export const parseAudioIntentV2 = (input: {
  prompt?: string;
  goal?: ProductGoal;
  scene?: ProductScene;
  guidedVoice?: boolean;
  environmentIntensity?: number;
  musicIntensity?: number;
  voiceIntensity?: number;
}): AudioIntentV2 => {
  const prompt = input.prompt?.trim() ?? '';
  const goal = input.goal ?? detectedGoal(prompt) ?? 'sleep';
  const scene = input.scene ?? defaultScene(goal, prompt);
  const detectedExclusions = exclusionTerms
    .filter((term) => new RegExp(`(?:no|without|avoid|do not want|don't want|not interested in|不要|没有|无|去掉|不想(?:听|要)?|不需要|不喜欢|不用|别(?:听|要)?)[^,.，。、]{0,12}(?:${term.match.source})`, 'i').test(prompt))
    .filter((term) => !(term.id === 'music' && /(没有节拍|无节拍|没有旋律|无旋律|no beat|without beat|non[- ]rhythmic|no melody)/i.test(prompt)))
    .map((term) => term.id);
  const excludedSounds = Array.from(new Set(detectedExclusions.flatMap((sound) => exclusionFamilyExpansion[sound] ?? [sound])));
  const environmentPreferences = soundTerms
    .filter((term) => term.match.test(prompt) && !excludedSounds.includes(term.id))
    .map((term) => term.id);
  const language = /[\u3400-\u9fff]/.test(prompt) ? 'zh' : 'en';
  const low = /(very quiet|minimal|low stimulation|gentle|quiet|low volume|soft volume|not too loud|can't be loud|shouldn't be loud|很安静|安静一点|极简|轻柔|不要刺激|低音量|小声|声音小|轻一点|不能(?:声音|音量)?太大|不能(?:声音|音量)?太响|不要(?:声音|音量)?太大|不要(?:声音|音量)?太响|音量不要大|声音不要大)/i.test(prompt);
  const strong = /(strong|immersive|intense|rich|明显|沉浸|强烈|丰富)/i.test(prompt);
  const warm = /(warm|cozy|soft|温暖|柔和|安心)/i.test(prompt);
  const spacious = /(space|spacious|open|distant|空灵|宽广|遥远|空间)/i.test(prompt);
  const steady = /(steady|constant|no sudden|less change|稳定|持续|不要突然|少变化)/i.test(prompt);
  const voiceExcluded = excludedSounds.includes('voice');
  const voiceRequestedByPrompt = /(voice|spoken|narration|guide|guided|真人|人声|语音|旁白|引导)/i.test(prompt);
  const guidedVoice = (Boolean(input.guidedVoice) || voiceRequestedByPrompt) && !voiceExcluded;
  const onlySounds = excludedSounds.includes('music') || /(only|just|只要|只有)[^,.，。]{0,16}(sound|noise|rain|ocean|forest|fire|wind|cricket|insect|fan|自然声|环境声|噪音|雨|海浪|森林|壁炉|风声|虫鸣|风扇)/i.test(prompt);
  const journeyRequested = /(journey|transition|evolve|progression|sound bath|疗愈旅程|声音旅程|逐渐|慢慢进入|音乐晚一点进入|过渡|先.{0,24}(再|然后).{0,24}(音乐|music|声音|sound)|music.{0,20}(enter|come in|start).{0,12}later|later.{0,20}music)/i.test(prompt);
  const musicRequested = /(music|piano|pad|drone|guitar|音乐|钢琴|吉他|氛围音乐)/i.test(prompt) && !excludedSounds.includes('music');
  const environmentRequested = environmentPreferences.length > 0 || /(fan|room tone|indoor|air conditioner|train|aircraft|airplane|plane cabin|风扇|室内|房间声|底噪|空调|火车|飞机|客舱|机舱)/i.test(prompt);
  const contentMode: ContentMode = guidedVoice
    ? 'guided_meditation'
    : onlySounds || (environmentRequested && !journeyRequested && !musicRequested)
      ? 'pure_soundscape'
      : journeyRequested
        ? 'sound_journey'
        : musicRequested || goal === 'focus'
          ? 'functional_music'
          : 'pure_soundscape';
  return {
    schemaVersion: 2,
    goal,
    scene,
    contentMode,
    environmentPreferences,
    excludedSounds,
    intensity: {
      environment: clamp(input.environmentIntensity, low ? 35 : strong ? 70 : 50),
      music: clamp(input.musicIntensity, low ? 30 : strong ? 65 : 50),
      voice: voiceExcluded ? 0 : clamp(input.voiceIntensity, 50),
    },
    qualities: {
      warmth: warm ? 75 : 50,
      spaciousness: spacious ? 75 : 50,
      variation: steady ? 25 : strong ? 65 : 45,
    },
    guidedVoice: {
      enabled: guidedVoice,
      language,
      density: /(frequent|more guidance|多一些引导|频繁)/i.test(prompt) ? 'frequent' : low ? 'light' : 'standard',
    },
  };
};
