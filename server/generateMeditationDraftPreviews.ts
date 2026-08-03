import path from 'node:path';
import { generateTts } from './ttsProvider';

const outputDir = path.resolve('public/audio/voice/research-2026-07-12');
const drafts = [
  {
    id: 'bedtime_body_scan',
    zh: '让自己慢慢安顿下来。\n\n不需要改变呼吸，只要注意它正在发生。\n\n感受双脚与下方支撑接触的地方。\n\n让脚踝不必再用力。\n\n感受小腿和大腿逐渐变得安静。\n\n让双手放在舒服的位置。\n\n发现肩膀现在的重量。\n\n让下巴和脸颊保持柔软。\n\n感受胸口随着呼吸轻轻移动。\n\n接下来不需要继续跟随指令。让背景声陪你休息。',
    en: 'Let yourself settle in.\n\nYou do not need to change your breathing. Simply notice it.\n\nNotice where your feet meet the support beneath you.\n\nLet your ankles be free from effort.\n\nFeel your legs becoming quiet and still.\n\nLet your hands rest wherever they are comfortable.\n\nNotice the weight of your shoulders.\n\nAllow your jaw and cheeks to soften.\n\nNotice the gentle movement of your chest as you breathe.\n\nYou do not need to follow another instruction. Let the background keep you company.',
  },
  {
    id: 'return_to_sleep',
    zh: '你现在不需要解决任何事情。\n\n保持当前舒服的姿势。\n\n只注意下一次自然的呼气。\n\n让背景声在远处持续，不需要追随它。\n\n如果思绪回来，也不必把它推开。\n\n接下来只保留安静的呼吸和背景声。',
    en: 'There is nothing you need to solve right now.\n\nStay in the position that feels comfortable.\n\nNotice only the next natural out-breath.\n\nLet the background continue at a distance. You do not need to follow it.\n\nIf thoughts return, you do not need to push them away.\n\nKeep only the quiet breath and the background sound.',
  },
  {
    id: 'short_stress_settling',
    zh: '先找到一个可以让身体停下来的位置。\n\n注意身体与椅子或地面的接触。\n\n让吸气自然进来，让呼气自然离开。\n\n听见离你最近的声音。\n\n再听见更远处的声音。\n\n这一刻不需要做出决定。\n\n继续用自己的节奏停留片刻。',
    en: 'First, find a position where your body can pause.\n\nNotice where your body meets the chair or the floor.\n\nLet the in-breath arrive, and let the out-breath leave naturally.\n\nNotice the sound that is closest to you.\n\nNow notice a sound that is farther away.\n\nYou do not need to make a decision in this moment.\n\nStay here for a little while in your own rhythm.',
  },
] as const;

const run = async () => {
  const results: Array<Record<string, unknown>> = [];
  const selectedDrafts = process.env.DRAFT_ID ? drafts.filter((draft) => draft.id === process.env.DRAFT_ID) : drafts;
  const selectedLanguages = process.env.DRAFT_LANGUAGE ? [process.env.DRAFT_LANGUAGE as 'zh' | 'en'] : ['zh', 'en'] as const;
  for (const draft of selectedDrafts) {
    for (const language of selectedLanguages) {
      const result = await generateTts({
        text: draft[language], language, outputDir, outputId: `${draft.id}_${language}_edge_preview`,
      });
      results.push({ id: draft.id, language, audioUrl: `/audio/voice/research-2026-07-12/${path.basename(result.outputPath)}`, provider: result.provider, commercialUseAllowed: result.commercialUseAllowed });
    }
  }
  console.log(JSON.stringify({ internalOnly: true, results }, null, 2));
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
