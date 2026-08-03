import type { I18nTranslate } from './i18n';

type SupplyDecisionSummaryInput = {
  kind: 'inventory_only' | 'inventory_plus_missing_stem' | 'unsupported_multi_gap';
  generationSpec?: { role?: string } | null;
};

export const summarizeSupplyDecision = (decision: SupplyDecisionSummaryInput, t: I18nTranslate) => {
  if (decision.kind === 'inventory_only') {
    return {
      label: t('player.supplyInventoryLabel'),
      description: t('player.supplyInventoryDescription'),
    };
  }
  if (decision.kind === 'inventory_plus_missing_stem') {
    return {
      label: t('player.supplyOneMissingLabel'),
      description: t('player.supplyOneMissingDescription', { role: decision.generationSpec?.role ?? 'layer' }),
    };
  }
  return {
    label: t('player.supplyBlockedLabel'),
    description: t('player.supplyBlockedDescription'),
  };
};
