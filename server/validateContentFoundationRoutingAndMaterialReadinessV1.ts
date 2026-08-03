import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type ReadinessReport = {
  reportId: string;
  status: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  routingDecision: {
    fixApplied: string;
    validatedBy: string;
    validatedRoutes: Record<string, string>;
  };
  materialCoverage: {
    validatedBy: string;
    targets: Record<string, number>;
    currentCounts: Record<string, number>;
    gap: Record<string, number>;
  };
  userFlowPolicy: {
    genericNeedRoute: string;
    explicitElementRoute: string;
    blockedMisuse: string[];
  };
  nextHighestLeverageWork: {
    step: string;
  };
};

type FormalBaseline = {
  baselineId: string;
  productionAllowed: boolean;
  targets: Record<string, number>;
};

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Content foundation routing/material readiness validation failed: ${message}`);
};

const readJson = <T>(relativePath: string): T => {
  const filePath = path.join(root, relativePath);
  if (!existsSync(filePath)) fail(`missing ${relativePath}`);
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
};

const report = readJson<ReadinessReport>('reports/content-foundation-routing-and-material-readiness-v1.json');
const baseline = readJson<FormalBaseline>('config/foundational-elements-formal-baseline-v1.json');

if (report.reportId !== 'content-foundation-routing-and-material-readiness-v1') fail('report id changed');
if (report.status !== 'internal_content_foundation_ready_for_controlled_composer_pilot') fail(`unexpected status ${report.status}`);
if (report.productionAllowed !== false || report.publicReleaseAllowed !== false) fail('production and public release must remain blocked');
if (baseline.baselineId !== 'foundational-elements-formal-baseline-v1') fail('formal baseline id changed');
if (baseline.productionAllowed !== false) fail('formal baseline must remain non-production');

if (report.routingDecision.validatedBy !== 'pnpm validate:content-foundation-routing-policy-v1') fail('routing validator command drifted');
if (report.materialCoverage.validatedBy !== 'pnpm validate:foundational-elements-formal-baseline-v1') fail('material validator command drifted');
if (report.userFlowPolicy.genericNeedRoute !== 'finished_internal_baseline_first') fail('generic route must be finished/internal baseline first');
if (report.userFlowPolicy.explicitElementRoute !== 'foundational_element_router') fail('explicit element route must use foundational router');
const reportPolicyText = JSON.stringify(report);
if (!reportPolicyText.includes('functional_music classification alone')) fail('report must preserve the MusicKit misroute correction');

const requiredFamilies = [
  'instrument_source',
  'music_template',
  'motif',
  'pad_drone',
  'environment_bed',
  'organic_texture',
  'accent_one_shot',
  'deterministic_acoustic_config',
] as const;

for (const family of requiredFamilies) {
  if (report.materialCoverage.targets[family] !== baseline.targets[family]) {
    fail(`${family} target does not match formal baseline`);
  }
  if (!Number.isFinite(report.materialCoverage.currentCounts[family])) fail(`${family} current count is missing`);
  if (!Number.isFinite(report.materialCoverage.gap[family])) fail(`${family} gap is missing`);
  if (report.materialCoverage.currentCounts[family] < report.materialCoverage.targets[family]) {
    fail(`${family} is under target`);
  }
  if (report.materialCoverage.gap[family] > 0) fail(`${family} still has a positive gap`);
}

const blockedMisuseText = report.userFlowPolicy.blockedMisuse.join(' ');
for (const required of ['route-proof renders', 'masking/noise', 'functional_music', 'finished songs']) {
  if (!blockedMisuseText.includes(required)) fail(`blocked misuse rule missing ${required}`);
}

if (report.nextHighestLeverageWork.step !== 'composer_bundle_plan_v1') fail('next work must be composer bundle plan');

console.log(JSON.stringify({
  passed: true,
  status: report.status,
  productionAllowed: report.productionAllowed,
  publicReleaseAllowed: report.publicReleaseAllowed,
  genericNeedRoute: report.userFlowPolicy.genericNeedRoute,
  explicitElementRoute: report.userFlowPolicy.explicitElementRoute,
  materialGap: report.materialCoverage.gap,
  nextHighestLeverageWork: report.nextHighestLeverageWork.step,
}, null, 2));
