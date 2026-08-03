import { readFileSync } from 'node:fs';

export type FoundationalElementRole = 'harmony' | 'melody' | 'low_support' | 'texture';
export type FoundationalElement = {
  id: string;
  candidateId: string;
  name: string;
  family: string;
  variant: number;
  elementRole: FoundationalElementRole;
  goals: Array<'sleep' | 'calm' | 'focus'>;
  tags: string[];
  audioUrl: string;
  defaultVolume: number;
  loop: { enabled: true; crossfadeSeconds: number };
  key: { root: string; rootIndex: number; mode: 'major' | 'minor'; confidence: number; profileScore: number };
  acoustic: {
    durationSeconds: number;
    bytes: number;
    codec: string;
    sampleRate: number;
    channels: number;
    integratedLufs: number;
    truePeakDb: number;
    estimatedTempoBpm: number;
    beatCount: number;
    onsetDensityPerSecond: number;
    spectralCentroidHz: number;
    loopTonalSimilarity: number;
    chroma: number[];
  };
  sha256: string;
  source: {
    provider: 'google-cloud-vertex-ai';
    product: 'lyria-music-generation';
    model: string;
    sourceCandidateId: string;
    sourceAudioUrl: string;
    prompt: string;
    generatedOn: string;
    projectId: string;
  };
  rights: {
    sourceCreator: string;
    licenseName: string;
    licenseUrl: string;
    commercialUseAllowed: true;
    derivativeUseAllowed: true;
    attributionRequired: boolean;
    rawRedistributionAllowed: boolean;
  };
  qa: {
    status: 'approved';
    ownerReviewEvidence: string;
    machineWarningsResolved: string[];
    collectionResidualRisk: string;
  };
};

const payload = JSON.parse(readFileSync(new URL('../config/foundational-audio-elements-v1.json', import.meta.url), 'utf8')) as {
  status: string;
  productionAllowed: boolean;
  elementCount: number;
  elements: FoundationalElement[];
};

if (payload.status !== 'approved_foundational_elements' || payload.productionAllowed !== true || payload.elementCount !== 24 || payload.elements.length !== 24) {
  throw new Error('Foundational element manifest is not approved or complete.');
}

export const foundationalElements = payload.elements;
