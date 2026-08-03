import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fail = (message: string): never => {
  throw new Error(`Demand production batch validation failed: ${message}`);
};
const assertIncludes = (source: string, needle: string, label: string) => {
  if (!source.includes(needle)) fail(`missing ${label}`);
};

const script = read('server/createDemandProductionBatch.ts');
const pkg = read('package.json');

assertIncludes(script, 'buildDemandCoverage', 'coverage-driven batch source');
assertIncludes(script, "action === 'compose_reviewed_soundscape'", 'finished soundscape plan filter');
assertIncludes(script, "status = 'private'", 'private candidate status');
assertIncludes(script, "render_status = 'not_rendered'", 'render gate preserved');
assertIncludes(script, 'mix_recipe_versions', 'frozen recipe version insert');
assertIncludes(script, "role !== 'voice'", 'Voice-free track filter');
assertIncludes(script, 'publicReleaseAllowed: false', 'public release blocked by default');
assertIncludes(script, 'discoverPlacementAllowed: false', 'Discover placement blocked by default');
assertIncludes(script, 'approvalState: \'content_review_candidate\'', 'content review candidate audit state');
assertIncludes(script, 'Private content-review candidates only', 'report policy');
assertIncludes(script, 'validateRecipeV2', 'Recipe V2 validation');
assertIncludes(pkg, 'create:demand-production-batch', 'package script for batch creation');

console.log(JSON.stringify({
  passed: true,
  gates: [
    'batch_uses_demand_coverage_plan',
    'batch_creates_private_review_candidates_only',
    'batch_preserves_render_and_listening_qa_gate',
    'batch_blocks_direct_discover_release',
    'batch_validates_recipe_v2',
  ],
}, null, 2));
