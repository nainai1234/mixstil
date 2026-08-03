import type { RecipeTrackRole, RecipeV2 } from './recipeV2';

export type RecipeEditResult = {
  recipe: RecipeV2;
  edit: {
    instruction: string;
    operation: string;
    changedTrackStemIds: string[];
    previousRecipeData: RecipeV2;
    createdAt: string;
  };
};

export type RecipeEditOptions = {
  approvedEnvironmentStemIds?: Partial<Record<'rain' | 'ocean' | 'forest' | 'water' | 'waterfall' | 'fire' | 'pond' | 'wind', string>>;
};

const cloneRecipe = (recipe: RecipeV2): RecipeV2 => JSON.parse(JSON.stringify(recipe));

const rolePatterns: Array<{ role: RecipeTrackRole; pattern: RegExp }> = [
  { role: 'environment', pattern: /(environment|nature|rain|ocean|wave|forest|water|wind|环境|自然|雨|海浪|海|森林|水声|风声)/i },
  { role: 'music', pattern: /(music|melody|pad|drone|piano|音乐|旋律|垫底|钢琴)/i },
  { role: 'voice', pattern: /(voice|guide|guidance|spoken|人声|引导|说话|旁白)/i },
  { role: 'accent', pattern: /(accent|chime|bell|点缀|铃|钟|提示音)/i },
  { role: 'base', pattern: /(base|noise|white noise|brown noise|底噪|白噪|棕噪|噪音)/i },
];

const clampVolume = (volume: number) => Math.max(0, Math.min(100, Math.round(volume)));

const trackKey = (track: any) => `${track.stemId}:${track.role}:${track.startTime}`;

const changedStemIds = (before: RecipeV2, after: RecipeV2) => {
  const beforeByKey = new Map(before.tracks.map((track: any) => [trackKey(track), JSON.stringify(track)]));
  return after.tracks
    .filter((track: any) => beforeByKey.get(trackKey(track)) !== JSON.stringify(track))
    .map((track: any) => String(track.stemId));
};

const roleFromInstruction = (instruction: string) =>
  rolePatterns.find((item) => item.pattern.test(instruction))?.role ?? null;

const replacementTerms: Array<{ key: keyof NonNullable<RecipeEditOptions['approvedEnvironmentStemIds']>; pattern: RegExp }> = [
  { key: 'ocean', pattern: /(ocean|sea|wave|海浪|大海|海边)/i },
  { key: 'rain', pattern: /(rain|雨声|下雨|雨)/i },
  { key: 'forest', pattern: /(forest|woods|森林|树林)/i },
  { key: 'wind', pattern: /(wind|breeze|风声|风)/i },
  { key: 'waterfall', pattern: /(waterfall|瀑布)/i },
  { key: 'water', pattern: /(stream|river|water|flowing water|流水|水声|溪流|河流)/i },
  { key: 'fire', pattern: /(fire|fireplace|campfire|火声|篝火|壁炉)/i },
  { key: 'pond', pattern: /(pond|cricket|池塘|蟋蟀)/i },
];

type EnvironmentSoundTarget = keyof NonNullable<RecipeEditOptions['approvedEnvironmentStemIds']> | 'bird' | 'train' | 'fan' | 'room';

const environmentTargetTerms: Array<{ key: EnvironmentSoundTarget; pattern: RegExp }> = [
  { key: 'waterfall', pattern: /(waterfall|瀑布)/i },
  { key: 'ocean', pattern: /(ocean|sea|wave|海浪|大海|海边)/i },
  { key: 'rain', pattern: /(rain|雨声|下雨|雨)/i },
  { key: 'water', pattern: /(stream|river|water sound|flowing water|流水|水声|溪流|河流)/i },
  { key: 'pond', pattern: /(pond|cricket|池塘|蟋蟀)/i },
  { key: 'forest', pattern: /(forest|woods|森林|树林)/i },
  { key: 'bird', pattern: /(birds?|birdsong|鸟叫|鸟鸣|鸟声)/i },
  { key: 'wind', pattern: /(wind|breeze|风声|风)/i },
  { key: 'fire', pattern: /(fire|fireplace|campfire|火声|篝火|壁炉)/i },
  { key: 'train', pattern: /(train|rail|列车|火车)/i },
  { key: 'fan', pattern: /(fan|风扇)/i },
  { key: 'room', pattern: /(room tone|indoor|quiet room|室内底噪|室内声)/i },
];

const environmentTargetsFromInstruction = (instruction: string) =>
  environmentTargetTerms.filter((term) => term.pattern.test(instruction)).map((term) => term.key);

const environmentTrackMatches = (stemIdInput: string, targets: EnvironmentSoundTarget[], options: RecipeEditOptions) => {
  const stemId = stemIdInput.toLowerCase();
  const aliases: Record<EnvironmentSoundTarget, string[]> = {
    rain: ['rain'],
    ocean: ['ocean', 'sea', 'wave'],
    forest: ['forest', 'wood'],
    bird: ['bird', 'birdsong'],
    water: ['water', 'stream', 'river'],
    waterfall: ['waterfall'],
    fire: ['fire', 'fireplace', 'campfire'],
    pond: ['pond', 'cricket'],
    wind: ['wind', 'breeze'],
    train: ['train', 'rail'],
    fan: ['fan'],
    room: ['room', 'indoor'],
  };
  const expandedTargets = targets.includes('water')
    ? Array.from(new Set<EnvironmentSoundTarget>([...targets, 'rain', 'ocean', 'waterfall', 'pond']))
    : targets;
  return expandedTargets.some((target) => (
    options.approvedEnvironmentStemIds?.[target as keyof NonNullable<RecipeEditOptions['approvedEnvironmentStemIds']>] === stemIdInput
    || aliases[target].some((alias) => stemId.includes(alias))
  ));
};

const negativeEnvironmentTargetsFromInstruction = (instruction: string) => {
  const segments = instruction.match(/(?:no|without|avoid|remove|delete|mute|turn off|do not want|don't want|不要|没有|去掉|删除|关闭|不想要|不需要|别要)[^,.，。;；]*/gi) ?? [];
  return [...new Set(segments.flatMap(environmentTargetsFromInstruction))];
};

const conceptByEnvironmentTarget: Partial<Record<EnvironmentSoundTarget, string>> = {
  rain: 'source.natural.water.rain',
  ocean: 'source.natural.water.ocean',
  forest: 'source.natural.forest',
  water: 'source.natural.water',
  waterfall: 'source.natural.water.waterfall',
  fire: 'source.natural.fire',
  pond: 'source.natural.water',
  wind: 'source.natural.wind',
  bird: 'source.animal.bird',
};

const legacyLabelByEnvironmentTarget: Partial<Record<EnvironmentSoundTarget, string>> = {
  rain: 'rain', ocean: 'ocean', forest: 'forest', water: 'water', waterfall: 'water',
  fire: 'fire', pond: 'water', wind: 'wind', bird: 'birds',
};

const addEnvironmentTracks = (
  recipe: RecipeV2,
  targets: EnvironmentSoundTarget[],
  options: RecipeEditOptions,
) => {
  const stemIds = [...new Set(targets
    .map((target) => options.approvedEnvironmentStemIds?.[target as keyof NonNullable<RecipeEditOptions['approvedEnvironmentStemIds']>])
    .filter((stemId): stemId is string => Boolean(stemId)))];
  if (stemIds.length === 0) throw new Error('The approved asset library does not contain the requested sound layer.');

  for (const stemId of stemIds) {
    const existing = recipe.tracks.find((track) => track.stemId === stemId);
    if (existing) {
      existing.isMuted = false;
      existing.volume = Math.max(1, Number(existing.volume ?? 12));
      continue;
    }
    recipe.tracks.push({
      stemId,
      role: 'environment',
      volume: 12,
      startTime: 0,
      duration: recipe.durationSeconds,
      trimStart: 0,
      trimEnd: recipe.durationSeconds,
      isMuted: false,
      playbackRate: 1,
      sourceGainDb: 0,
      phaseIds: recipe.phases.map((phase) => phase.id),
      fade: { inSeconds: Math.min(4, Math.max(1, recipe.durationSeconds * 0.01)), outSeconds: Math.min(6, Math.max(2, recipe.durationSeconds * 0.015)) },
      loop: { enabled: true, crossfadeSeconds: 3 },
    });
  }
};

const updateAudioIntentForEnvironmentAddition = (
  recipe: RecipeV2,
  addedTargets: EnvironmentSoundTarget[],
  negativeTargets: EnvironmentSoundTarget[],
  instruction: string,
) => {
  const audioIntent = recipe.audioIntent as any;
  if (!audioIntent) return;
  const addedConcepts = addedTargets.map((target) => conceptByEnvironmentTarget[target]).filter(Boolean) as string[];
  const addedLabels = addedTargets.map((target) => legacyLabelByEnvironmentTarget[target]).filter(Boolean) as string[];
  const negativeConcepts = negativeTargets.map((target) => conceptByEnvironmentTarget[target]).filter(Boolean) as string[];
  const negativeLabels = negativeTargets.map((target) => legacyLabelByEnvironmentTarget[target]).filter(Boolean) as string[];
  if (/(?:no|without|不要|去掉|不需要)[^,.，。]{0,16}(music|melody|音乐|旋律)/i.test(instruction)) {
    negativeConcepts.push('source.music');
    negativeLabels.push('music');
  }
  if (/(?:no|without|不要|去掉|不需要)[^,.，。]{0,16}(voice|voices|speech|人声|语音|旁白)/i.test(instruction)) {
    negativeConcepts.push('source.human.voice');
    negativeLabels.push('voice');
  }
  audioIntent.excludedConceptIds = [...new Set([
    ...((audioIntent.excludedConceptIds ?? []) as string[]).filter((concept) => !addedConcepts.some((added) => concept === added || concept.startsWith(`${added}.`))),
    ...negativeConcepts,
  ])];
  audioIntent.excludedSounds = [...new Set([
    ...((audioIntent.excludedSounds ?? []) as string[]).filter((label) => !addedLabels.includes(label)),
    ...negativeLabels,
  ])];
  audioIntent.preferredConceptIds = [...new Set([...((audioIntent.preferredConceptIds ?? []) as string[]), ...addedConcepts])];
  audioIntent.environmentPreferences = [...new Set([...((audioIntent.environmentPreferences ?? []) as string[]), ...addedLabels])];
};

const updateSpecificEnvironmentTracks = (
  recipe: RecipeV2,
  targets: EnvironmentSoundTarget[],
  options: RecipeEditOptions,
  update: (track: RecipeV2['tracks'][number]) => RecipeV2['tracks'][number],
) => {
  let matched = 0;
  recipe.tracks = recipe.tracks.map((track) => {
    if (track.role !== 'environment' || !environmentTrackMatches(String(track.stemId), targets, options)) return track;
    matched += 1;
    return update(track);
  });
  if (matched === 0) throw new Error('The requested sound is not present in this mix.');
};

const replacementTarget = (instruction: string, options: RecipeEditOptions) => {
  const explicitTarget = instruction.match(/(?:to|into|with|换成|改成|替换成|变成)\s*([^,.，。]+)/i)?.[1] ?? instruction;
  const match = replacementTerms.find((term) => term.pattern.test(explicitTarget));
  return match ? options.approvedEnvironmentStemIds?.[match.key] ?? null : null;
};

const applyRoleVolume = (recipe: RecipeV2, role: RecipeTrackRole, delta: number) => {
  recipe.tracks = recipe.tracks.map((track) => track.role === role
    ? { ...track, volume: clampVolume(Number(track.volume ?? 0) + delta), isMuted: delta > 0 ? false : track.isMuted }
    : track);
};

type VolumeCurveShape = 'rise' | 'fall' | 'dip' | 'peak';

const volumeCurveForTrack = (track: RecipeV2['tracks'][number], shape: VolumeCurveShape) => {
  const ceiling = clampVolume(Number(track.volume ?? 0));
  const duration = Math.max(1, Number(track.duration ?? 1));
  const ratios: Record<VolumeCurveShape, number[]> = {
    rise: [0.25, 0.45, 0.65, 0.82, 1],
    fall: [1, 0.82, 0.65, 0.45, 0.25],
    dip: [1, 0.72, 0.32, 0.72, 1],
    peak: [0.32, 0.72, 1, 0.72, 0.32],
  };
  return {
    ...track,
    volumeAutomation: ratios[shape].map((ratio, index) => ({
      atSeconds: duration * (index / 4),
      volume: clampVolume(ceiling * ratio),
    })),
  };
};

const applyRoleVolumeCurve = (recipe: RecipeV2, role: RecipeTrackRole, shape: VolumeCurveShape) => {
  let matched = 0;
  recipe.tracks = recipe.tracks.map((track) => {
    if (track.role !== role || track.isMuted || Number(track.volume ?? 0) <= 0) return track;
    matched += 1;
    return volumeCurveForTrack(track, shape);
  });
  if (matched === 0) throw new Error('The requested sound layer is not active in this mix.');
};

type TimingDirection = 'later' | 'earlier';

const shiftTrackEntry = (recipe: RecipeV2, track: RecipeV2['tracks'][number], direction: TimingDirection) => {
  const currentStart = Math.max(0, Number(track.startTime ?? 0));
  const currentDuration = Math.max(1, Number(track.duration ?? 1));
  const currentEnd = Math.min(recipe.durationSeconds, currentStart + currentDuration);
  const shiftSeconds = Math.min(120, Math.max(15, Math.round(recipe.durationSeconds * 0.1)));
  const nextStart = direction === 'later'
    ? Math.min(currentEnd - 1, currentStart + shiftSeconds)
    : Math.max(0, currentStart - shiftSeconds);
  if (Math.abs(nextStart - currentStart) < 0.01) return track;
  const nextDuration = Math.max(1, currentEnd - nextStart);
  const durationRatio = nextDuration / currentDuration;
  const volumeAutomation = track.volumeAutomation?.map((point) => ({
    ...point,
    atSeconds: Math.min(nextDuration, Math.max(0, Number(point.atSeconds ?? 0) * durationRatio)),
  }));
  const phaseIds = recipe.phases
    ?.filter((phase) => phase.startTime < currentEnd && phase.startTime + phase.duration > nextStart)
    .map((phase) => phase.id);
  return {
    ...track,
    startTime: nextStart,
    duration: nextDuration,
    volumeAutomation,
    phaseIds: phaseIds?.length ? phaseIds : track.phaseIds,
  };
};

const applyRoleEntryShift = (recipe: RecipeV2, role: RecipeTrackRole, direction: TimingDirection) => {
  let matched = 0;
  let changed = 0;
  recipe.tracks = recipe.tracks.map((track) => {
    if (track.role !== role || track.isMuted || Number(track.volume ?? 0) <= 0) return track;
    matched += 1;
    const shifted = shiftTrackEntry(recipe, track, direction);
    if (shifted !== track) changed += 1;
    return shifted;
  });
  if (matched === 0) throw new Error('The requested sound layer is not active in this mix.');
  if (changed === 0) throw new Error(direction === 'earlier' ? 'This sound layer already starts at the beginning.' : 'This sound layer cannot start any later.');
};

const muteRole = (recipe: RecipeV2, role: RecipeTrackRole) => {
  recipe.tracks = recipe.tracks.map((track) => track.role === role ? { ...track, isMuted: true, volume: 0 } : track);
  if (role === 'accent') recipe.events = [];
};

const extendRecipe = (recipe: RecipeV2, seconds: number) => {
  const nextDuration = Math.min(7200, recipe.durationSeconds + seconds);
  const delta = nextDuration - recipe.durationSeconds;
  recipe.durationSeconds = nextDuration;
  recipe.tracks = recipe.tracks.map((track) => {
    if (track.role === 'accent' || track.role === 'voice') return track;
    return { ...track, duration: Number(track.duration ?? 0) + delta, trimEnd: Number(track.trimEnd ?? 0) + delta };
  });
};

const updateVoicePlaybackRate = (recipe: RecipeV2, nextRate: number) => {
  recipe.tracks = recipe.tracks.map((track) => {
    if (track.role !== 'voice') return track;
    const currentRate = Math.max(0.5, Math.min(2, Number.isFinite(Number(track.playbackRate)) ? Number(track.playbackRate) : 1));
    const sourceDuration = Number(track.duration ?? 0) * currentRate;
    const normalizedRate = Math.max(0.5, Math.min(2, nextRate));
    return {
      ...track,
      playbackRate: normalizedRate,
      duration: Math.max(1, sourceDuration / normalizedRate),
      trimEnd: Math.max(1, sourceDuration / normalizedRate),
      fade: {
        ...track.fade,
        outSeconds: Math.min(Number(track.fade?.outSeconds ?? 1.2), 0.8),
      },
    };
  });
};

export const applyDeterministicRecipeEdit = (
  recipeInput: RecipeV2,
  instructionInput: string,
  options: RecipeEditOptions = {},
): RecipeEditResult => {
  const instruction = instructionInput.trim();
  if (!instruction) throw new Error('Edit instruction is required.');
  const lower = instruction.toLowerCase();
  const before = cloneRecipe(recipeInput);
  const recipe = cloneRecipe(recipeInput);
  let operation = 'unsupported';

  const role = roleFromInstruction(instruction);
  const environmentTargets = role === 'environment' ? environmentTargetsFromInstruction(instruction) : [];
  const negativeEnvironmentTargets = negativeEnvironmentTargetsFromInstruction(instruction);
  const additionEnvironmentTargets = environmentTargets.filter((target) => !negativeEnvironmentTargets.includes(target));
  const addIntent = /(add|include|bring in|layer in|mix in|添加|加入|加上|增加|放入)/i.test(instruction);
  const removeIntent = /(remove|delete|mute|turn off|no |without|去掉|删除|关闭|不要|静音)/i.test(instruction);
  const louderIntent = /(louder|higher|more|stronger|up|大一点|更大|明显|加强|多一点)/i.test(instruction);
  const quieterIntent = /(quieter|lower|less|softer|down|小一点|更小|安静|轻一点|少一点)/i.test(instruction);
  const riseIntent = /(fade in|gradually|slowly).*(louder|increase|stronger)|渐强|(逐渐|慢慢).*(变大|增大|更大|加强|响)/i.test(instruction);
  const fallIntent = /(fade out|gradually|slowly).*(quieter|decrease|softer|lower)|渐弱|(逐渐|慢慢).*(变小|减小|更小|降低|轻|弱)/i.test(instruction);
  const centerDipIntent = /(middle|center).*(quieter|lower|softer|dip)|中间.*(小|低|轻|弱)/i.test(instruction);
  const centerPeakIntent = /(middle|center).*(louder|higher|stronger|peak)|中间.*(大|高|强|响)/i.test(instruction);
  const laterEntryIntent = /(bring|enter|come in|start|begin).*(later)|later.*(enter|come in|start|begin)|(晚一点|晚些|稍后).*(进入|出现|开始|进来)|(进入|出现|开始|进来).*(晚一点|晚些|稍后)|后面再(进入|出现|开始|进来)?|之后再(进入|出现|开始|进来)?/i.test(instruction);
  const earlierEntryIntent = /(bring|enter|come in|start|begin).*(earlier)|earlier.*(enter|come in|start|begin)|(早一点|早点|提前).*(进入|出现|开始|进来)|(进入|出现|开始|进来).*(早一点|早点|提前)/i.test(instruction);
  const curveShape: VolumeCurveShape | null = centerDipIntent
    ? 'dip'
    : centerPeakIntent
      ? 'peak'
      : riseIntent
        ? 'rise'
        : fallIntent
          ? 'fall'
          : null;

  const replacementStemId = /(replace|switch|change|swap|换成|改成|替换|变成)/i.test(instruction)
    ? replacementTarget(instruction, options)
    : null;

  if (addIntent && role === 'environment' && additionEnvironmentTargets.length > 0) {
    addEnvironmentTracks(recipe, additionEnvironmentTargets, options);
    updateAudioIntentForEnvironmentAddition(recipe, additionEnvironmentTargets, negativeEnvironmentTargets, instruction);
    operation = 'add_environment';
  } else if (replacementStemId && (role === 'environment' || /rain|ocean|forest|water|fire|雨|海|森林|水|火/.test(instruction))) {
    recipe.tracks = recipe.tracks.map((track) => track.role === 'environment'
      ? { ...track, stemId: replacementStemId, isMuted: false }
      : track);
    operation = 'replace_environment';
  } else if (/(replace|switch|change|swap|换成|改成|替换|变成)/i.test(instruction) && role === 'environment') {
    throw new Error('Requested environment replacement is not available as an approved core stem.');
  } else if (removeIntent && role === 'environment' && environmentTargets.length > 0) {
    updateSpecificEnvironmentTracks(recipe, environmentTargets, options, (track) => ({ ...track, isMuted: true, volume: 0 }));
    operation = 'mute_environment';
  } else if (laterEntryIntent && role === 'environment' && environmentTargets.length > 0) {
    updateSpecificEnvironmentTracks(recipe, environmentTargets, options, (track) => shiftTrackEntry(recipe, track, 'later'));
    operation = 'start_later_environment';
  } else if (earlierEntryIntent && role === 'environment' && environmentTargets.length > 0) {
    updateSpecificEnvironmentTracks(recipe, environmentTargets, options, (track) => shiftTrackEntry(recipe, track, 'earlier'));
    operation = 'start_earlier_environment';
  } else if (laterEntryIntent && role && role !== 'accent' && role !== 'voice') {
    applyRoleEntryShift(recipe, role, 'later');
    operation = `start_later_${role}`;
  } else if (earlierEntryIntent && role && role !== 'accent' && role !== 'voice') {
    applyRoleEntryShift(recipe, role, 'earlier');
    operation = `start_earlier_${role}`;
  } else if (curveShape && role === 'environment' && environmentTargets.length > 0) {
    updateSpecificEnvironmentTracks(recipe, environmentTargets, options, (track) => volumeCurveForTrack(track, curveShape));
    operation = `volume_${curveShape}_environment`;
  } else if (curveShape && role) {
    applyRoleVolumeCurve(recipe, role, curveShape);
    operation = `volume_${curveShape}_${role}`;
  } else if (role === 'environment' && environmentTargets.length > 0 && louderIntent) {
    updateSpecificEnvironmentTracks(recipe, environmentTargets, options, (track) => ({
      ...track,
      volume: clampVolume(Number(track.volume ?? 0) + 12),
      isMuted: false,
    }));
    operation = 'increase_environment';
  } else if (role === 'environment' && environmentTargets.length > 0 && quieterIntent) {
    updateSpecificEnvironmentTracks(recipe, environmentTargets, options, (track) => ({
      ...track,
      volume: clampVolume(Number(track.volume ?? 0) - 12),
    }));
    operation = 'decrease_environment';
  } else if (removeIntent && role) {
    muteRole(recipe, role);
    operation = `mute_${role}`;
  } else if (role && louderIntent) {
    applyRoleVolume(recipe, role, 12);
    operation = `increase_${role}`;
  } else if (role && quieterIntent) {
    applyRoleVolume(recipe, role, -12);
    operation = `decrease_${role}`;
  } else if (/(quieter|minimal|less stimulation|更安静|极简|不要刺激)/i.test(instruction)) {
    recipe.tracks = recipe.tracks.map((track) => track.role === 'accent'
      ? { ...track, isMuted: true, volume: 0 }
      : {
          ...track,
          volume: Number(track.volume ?? 0) <= 0
            ? 0
            : Math.max(1, clampVolume(Math.round(Number(track.volume) * (track.role === 'voice' ? 0.8 : 0.7)))),
        });
    recipe.events = [];
    operation = 'overall_quieter';
  } else if (/(warmer|cozier|softer|温暖|柔和|安心)/i.test(instruction)) {
    applyRoleVolume(recipe, 'base', 6);
    applyRoleVolume(recipe, 'environment', -5);
    operation = 'warmer';
  } else if (/(less change|less variation|steady|stable|少变化|稳定|持续)/i.test(instruction)) {
    muteRole(recipe, 'accent');
    const audioIntent = recipe.audioIntent as any;
    recipe.audioIntent = audioIntent?.qualities ? {
      ...audioIntent,
      qualities: { ...audioIntent.qualities, variation: Math.max(0, Number(audioIntent.qualities.variation ?? 0) - 25) },
    } : recipe.audioIntent;
    operation = 'less_variation';
  } else if (/(longer|extend|延长|更长|久一点)/i.test(instruction)) {
    extendRecipe(recipe, 300);
    operation = 'extend_duration';
  } else if (/(slower|slow down|speak slower|更慢|慢一点|放慢|说慢一点|人声更慢)/i.test(instruction)) {
    updateVoicePlaybackRate(recipe, 0.9);
    operation = 'voice_slower';
  } else if (/(end.*voice.*earlier|voice.*earlier|人声.*早点结束|引导.*早点结束)/i.test(lower)) {
    recipe.tracks = recipe.tracks.map((track) => track.role === 'voice'
      ? { ...track, duration: Math.max(1, Number(track.duration ?? 1) * 0.8), fade: { ...track.fade, outSeconds: Math.min(track.fade.outSeconds, 0.8) } }
      : track);
    operation = 'voice_ends_earlier';
  }

  if (operation === 'unsupported') {
    throw new Error('This edit is outside the deterministic edit set.');
  }

  recipe.versionState = 'live';
  recipe.versionId = `live-${recipe.randomSeed}-${Date.now()}`;
  recipe.audit = {
    ...(recipe.audit ?? {}),
    edits: [
      ...(((recipe.audit as any)?.edits ?? []) as any[]),
      { instruction, operation, changedTrackStemIds: changedStemIds(before, recipe), createdAt: new Date().toISOString() },
    ],
    undoStack: [
      ...(((recipe.audit as any)?.undoStack ?? []) as any[]),
      before,
    ].slice(-5),
  };

  return {
    recipe,
    edit: {
      instruction,
      operation,
      changedTrackStemIds: changedStemIds(before, recipe),
      previousRecipeData: before,
      createdAt: new Date().toISOString(),
    },
  };
};
