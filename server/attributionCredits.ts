export type StemCreditInput = {
  id: string;
  name: string;
  sourcePlatform: string;
  sourceUrl: string;
  sourceCreator: string;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
};

export type AttributionCredit = {
  stemId: string;
  title: string;
  creator: string;
  sourcePlatform: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  attributionText: string;
  adaptationNotice: string;
};

const clean = (value: unknown) => String(value ?? '').trim();
export const MIXSTIL_ADAPTATION_NOTICE = 'Used as source material in a MixStil soundscape; playback may include looping, volume balancing, trimming, layering, or rendering with other approved sounds.';

export const buildAttributionCredits = (
  stems: StemCreditInput[],
  activeStemIds: string[] = stems.map((stem) => stem.id),
): AttributionCredit[] => {
  const active = new Set(activeStemIds);
  const seen = new Set<string>();
  const credits: AttributionCredit[] = [];

  for (const stem of stems) {
    if (!active.has(stem.id) || seen.has(stem.id) || !stem.attributionRequired) continue;
    seen.add(stem.id);

    const title = clean(stem.name);
    const creator = clean(stem.sourceCreator);
    const sourcePlatform = clean(stem.sourcePlatform);
    const licenseName = clean(stem.licenseName);
    const sourceUrl = clean(stem.sourceUrl);
    const licenseUrl = clean(stem.licenseUrl);
    const byline = creator ? `${title} by ${creator}` : title;
    const platform = sourcePlatform ? ` via ${sourcePlatform}` : '';

    credits.push({
      stemId: stem.id,
      title,
      creator,
      sourcePlatform,
      sourceUrl,
      licenseName,
      licenseUrl,
      attributionText: `${byline}${platform} is licensed under ${licenseName}.`,
      adaptationNotice: MIXSTIL_ADAPTATION_NOTICE,
    });
  }

  return credits;
};
