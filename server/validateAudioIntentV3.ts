import { parseAudioIntentV3 } from './audioIntentV3';

const racingThoughts = parseAudioIntentV3({
  prompt: '晚上睡不着，脑子停不下来，声音不要突然变化，希望慢慢安静下来。',
  goal: 'sleep',
  durationSeconds: 1200,
});
if (racingThoughts.schemaVersion !== 3 || racingThoughts.sessionSubtype !== 'sleep_onset') throw new Error('Sleep-onset subtype was not preserved.');
if (racingThoughts.currentState.mentalActivity !== 'high') throw new Error('Racing thoughts were not recognized as high mental activity.');
if (racingThoughts.desiredTrajectory !== 'settle_gradually') throw new Error('Gradual settling trajectory was not recognized.');
if (racingThoughts.stimulationTolerance.transientSensitivity !== 'high' || racingThoughts.stimulationTolerance.eventDensity !== 'low') throw new Error('Sleep stimulation sensitivity was not recognized.');

const returnToSleep = parseAudioIntentV3({ prompt: '半夜醒了，想尽快重新睡着，只要稳定的低音量背景。', goal: 'sleep', durationSeconds: 900 });
if (returnToSleep.sessionSubtype !== 'return_to_sleep' || returnToSleep.desiredTrajectory !== 'settle_quickly') throw new Error('Return-to-sleep intent lost its subtype or trajectory.');

const reading = parseAudioIntentV3({ prompt: '白天戴耳机阅读写作，很容易分心，需要少变化、没有旋律的专注背景。', goal: 'focus', durationSeconds: 1500 });
if (reading.sessionSubtype !== 'reading_writing') throw new Error('Reading and writing subtype was not recognized.');
if (reading.currentState.attentionStability !== 'low') throw new Error('Distractibility was not recognized.');
if (reading.context.device !== 'headphones' || reading.context.timeOfDay !== 'day') throw new Error('Listening context was not preserved.');
if (reading.stimulationTolerance.melody !== 'none' || reading.stimulationTolerance.variation !== 'low') throw new Error('Focus stimulation constraints were not recognized.');

const grounding = parseAudioIntentV3({ prompt: '我现在很焦虑，想做十分钟 grounding，让注意力回到身体和脚底。', goal: 'calm', durationSeconds: 600 });
if (grounding.sessionSubtype !== 'grounding' || grounding.currentState.emotionalTension !== 'high') throw new Error('Grounding or emotional tension was not recognized.');

const allNight = parseAudioIntentV3({ prompt: '整夜循环播放，遮住外面的噪音，不要音乐。', goal: 'sleep', durationSeconds: 3600 });
if (allNight.sessionSubtype !== 'all_night_masking' || allNight.context.loopPreference !== 'continuous') throw new Error('All-night masking context was not recognized.');

console.log(JSON.stringify({
  passed: true,
  intents: [racingThoughts, returnToSleep, reading, grounding, allNight].map((intent) => ({
    goal: intent.goal,
    scene: intent.scene,
    sessionSubtype: intent.sessionSubtype,
    desiredTrajectory: intent.desiredTrajectory,
    currentState: intent.currentState,
    stimulationTolerance: intent.stimulationTolerance,
    context: intent.context,
  })),
}, null, 2));
