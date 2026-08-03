import { query } from './db';
import type { ContentMode, ProductGoal, ProductScene } from './contentCatalog';

export type GenerationDecisionKind = 'inventory_only' | 'inventory_plus_missing_stem' | 'unsupported_multi_gap';
export type MissingStemRole = 'music.bed' | 'environment.scene' | 'base.masking' | 'accent.event';

export type SupplyGenerationSpec = {
  targetConceptIds: string[];
  semanticDescription: string;
  role: MissingStemRole;
  durationSeconds: number;
  loopRequired: boolean;
  acousticTargets: {
    brightness: [number, number];
    eventDensity: [number, number];
    dynamicRangeDb: [number, number];
  };
  forbiddenConceptIds: string[];
  phaseFit: Array<'arrival' | 'settling' | 'core' | 'release'>;
  candidateCount: number;
  providerPolicy: 'local_musickit_factory_only' | 'approved_inventory_import_first_then_external_sfx_candidates';
};

export type GenerationDecision = {
  kind: GenerationDecisionKind;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: ContentMode;
  inventoryStemIds: string[];
  missing: Array<{ role: MissingStemRole; conceptIds: string[] }>;
  generationSpec: SupplyGenerationSpec | null;
  fullTrackProviderAllowed: false;
  reason: string;
};

const roleRequirements = (mode: ContentMode): MissingStemRole[][] => {
  if (mode === 'pure_soundscape') return [['environment.scene', 'base.masking']];
  if (mode === 'functional_music') return [['music.bed']];
  return [['environment.scene', 'base.masking'], ['music.bed']];
};

const specFor = (input: {
  prompt: string;
  role: MissingStemRole;
  conceptIds: string[];
  excludedConceptIds: string[];
}): SupplyGenerationSpec => ({
  targetConceptIds: input.conceptIds,
  semanticDescription: `Missing ${input.role} for: ${input.prompt}`,
  role: input.role,
  durationSeconds: input.role === 'accent.event' ? 8 : input.role === 'music.bed' ? 96 : 30,
  loopRequired: input.role !== 'accent.event',
  acousticTargets: {
    brightness: input.role === 'music.bed' ? [0.2, 0.55] : [0.15, 0.65],
    eventDensity: input.role === 'music.bed' ? [0.05, 0.35] : [0.05, 0.5],
    dynamicRangeDb: input.role === 'music.bed' ? [3, 8] : [3, 12],
  },
  forbiddenConceptIds: [...new Set(['source.human.voice', ...input.excludedConceptIds])],
  phaseFit: input.role === 'accent.event' ? ['arrival', 'release'] : ['arrival', 'settling', 'core', 'release'],
  candidateCount: 4,
  providerPolicy: input.role === 'music.bed'
    ? 'local_musickit_factory_only'
    : 'approved_inventory_import_first_then_external_sfx_candidates',
});

export const decideGeneration = async (input: {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: ContentMode;
  requiredConceptIds?: string[];
  excludedConceptIds?: string[];
}): Promise<GenerationDecision> => {
  const excludedConceptIds = [...new Set(input.excludedConceptIds ?? [])];
  const candidates = await query<{
    id: string;
    roles: string[];
    concepts: string[];
  }>(
    `select s.id, m.roles,
       array_remove(array_agg(sc.concept_id order by sc.concept_id), null) as concepts
     from audio_stems s
     join stem_metadata_v3 m on m.stem_id=s.id and m.metadata_version=3
     left join stem_concepts sc on sc.stem_id=s.id and sc.verified=true
     where s.qa_status='approved' and s.commercial_use_allowed=true and s.derivative_use_allowed=true
     group by s.id,m.stem_id`,
  );
  const eligible = candidates.rows.filter((candidate) => !candidate.concepts.some((concept) => (
    excludedConceptIds.some((excluded) => concept === excluded || concept.startsWith(`${excluded}.`))
  )));
  const missing: GenerationDecision['missing'] = [];
  for (const alternatives of roleRequirements(input.contentMode)) {
    if (!eligible.some((candidate) => alternatives.some((role) => candidate.roles.includes(role)))) {
      missing.push({ role: alternatives[0], conceptIds: [] });
    }
  }
  for (const conceptId of [...new Set(input.requiredConceptIds ?? [])]) {
    const found = eligible.some((candidate) => candidate.concepts.some((concept) => concept === conceptId || concept.startsWith(`${conceptId}.`)));
    if (!found) {
      const role: MissingStemRole = conceptId.startsWith('source.music') ? 'music.bed'
        : conceptId.startsWith('source.accent') ? 'accent.event' : 'environment.scene';
      const existing = missing.find((item) => item.role === role);
      if (existing) existing.conceptIds.push(conceptId);
      else missing.push({ role, conceptIds: [conceptId] });
    }
  }
  const inventoryStemIds = eligible.map((candidate) => candidate.id);
  if (missing.length === 0) {
    return {
      kind: 'inventory_only', goal: input.goal, scene: input.scene, contentMode: input.contentMode,
      inventoryStemIds, missing: [], generationSpec: null, fullTrackProviderAllowed: false,
      reason: 'Approved first-party inventory covers every required role and concept.',
    };
  }
  if (missing.length === 1) {
    return {
      kind: 'inventory_plus_missing_stem', goal: input.goal, scene: input.scene, contentMode: input.contentMode,
      inventoryStemIds, missing,
      generationSpec: specFor({ prompt: input.prompt, role: missing[0].role, conceptIds: missing[0].conceptIds, excludedConceptIds }),
      fullTrackProviderAllowed: false,
      reason: `Approved inventory is usable after one missing ${missing[0].role} Stem is supplied and passes QA.`,
    };
  }
  return {
    kind: 'unsupported_multi_gap', goal: input.goal, scene: input.scene, contentMode: input.contentMode,
    inventoryStemIds, missing, generationSpec: null, fullTrackProviderAllowed: false,
    reason: 'More than one independent layer is missing; record the gaps instead of generating a full track.',
  };
};
