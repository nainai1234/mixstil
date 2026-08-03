import { buildAttributionCredits, MIXSTIL_ADAPTATION_NOTICE, type StemCreditInput } from './attributionCredits';
import { planRecipeRenderTracks } from './renderRecipeV2';

export type WorkAttributionSidecar = {
  schemaVersion: 1;
  mixId: string;
  title: string;
  releaseChannel: 'voice-free-beta';
  recipeVersionId: string | null;
  generatedAt: string;
  activeStemIds: string[];
  attributionRequired: boolean;
  attributionSummary: string;
  adaptationNotice: string;
  audioCreditsPath: '/audio-credits';
  credits: ReturnType<typeof buildAttributionCredits>;
};

export const buildWorkAttributionSidecar = (input: {
  mixId: string;
  title: string;
  recipeVersionId?: string | null;
  recipe: any;
  stems: StemCreditInput[];
  generatedAt?: string;
}): WorkAttributionSidecar => {
  const activeStemIds = Array.from(new Set<string>(
    planRecipeRenderTracks(input.recipe)
      .filter((track: any) => !track.isMuted && Number(track.volume ?? 0) > 0)
      .map((track: any) => String(track.stemId)),
  ));
  const credits = buildAttributionCredits(input.stems, activeStemIds);

  return {
    schemaVersion: 1,
    mixId: input.mixId,
    title: input.title,
    releaseChannel: 'voice-free-beta',
    recipeVersionId: input.recipeVersionId
      ?? (input.recipe?.versionState === 'frozen' ? input.recipe.versionId ?? null : null),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    activeStemIds,
    attributionRequired: credits.length > 0,
    attributionSummary: credits.length > 0
      ? `${credits.length} source${credits.length === 1 ? '' : 's'} require public attribution.`
      : 'No source in this rendered soundscape requires a public byline. Approved-source, rights, and Voice-free Beta release rules still apply.',
    adaptationNotice: MIXSTIL_ADAPTATION_NOTICE,
    audioCreditsPath: '/audio-credits',
    credits,
  };
};

export const formatWorkAttributionSidecarText = (sidecar: WorkAttributionSidecar, appOrigin = '') => {
  const creditsUrl = `${appOrigin.replace(/\/+$/, '')}${sidecar.audioCreditsPath}`;
  const lines = [
    'MixStil WORK COPYRIGHT & CREDITS',
    '',
    `Title: ${sidecar.title}`,
    `Mix ID: ${sidecar.mixId}`,
    `Release channel: ${sidecar.releaseChannel}`,
    `Frozen recipe version: ${sidecar.recipeVersionId ?? 'not available'}`,
    `Generated: ${sidecar.generatedAt}`,
    '',
    sidecar.attributionSummary,
    '',
  ];

  if (sidecar.credits.length > 0) {
    lines.push('REQUIRED ATTRIBUTION', '');
    sidecar.credits.forEach((credit, index) => {
      lines.push(
        `${index + 1}. ${credit.attributionText}`,
        `   Source: ${credit.sourceUrl}`,
        `   License: ${credit.licenseName} — ${credit.licenseUrl}`,
        `   Adaptation: ${credit.adaptationNotice}`,
        '',
      );
    });
  }

  lines.push(
    'GENERAL ADAPTATION NOTICE',
    sidecar.adaptationNotice,
    '',
    `Full Voice-free Beta audio credits: ${creditsUrl || sidecar.audioCreditsPath}`,
    '',
  );
  return lines.join('\n');
};
