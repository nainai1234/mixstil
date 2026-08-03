import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fail = (message: string): never => {
  throw new Error(`Demand production review handoff validation failed: ${message}`);
};
const assertIncludes = (source: string, needle: string, label: string) => {
  if (!source.includes(needle)) fail(`missing ${label}`);
};

const dashboard = read('src/pages/AdminDashboard.tsx');

assertIncludes(dashboard, '导出听审清单', 'review manifest export action');
assertIncludes(dashboard, 'humanReviewRequired: true', 'manifest preserves human review requirement');
assertIncludes(dashboard, 'productionAllowed: false', 'manifest blocks production interpretation');
assertIncludes(dashboard, 'human_review_then_release_governance_then_discover_selection', 'manifest handoff boundary');
assertIncludes(dashboard, '去发现页配置', 'review to Discover handoff action');
assertIncludes(dashboard, "onOpenDiscover={() => selectAdminSection('discover')}", 'hash-aware Discover navigation handoff');

const manifestStart = dashboard.indexOf('const downloadReviewManifest = () =>');
const manifestEnd = dashboard.indexOf('return (', manifestStart);
if (manifestStart < 0 || manifestEnd < 0) fail('could not isolate review manifest export block');
const manifestBlock = dashboard.slice(manifestStart, manifestEnd);
if (manifestBlock.includes('api.reviewAdminDemandProductionCandidate') || manifestBlock.includes('api.releaseAdminDemandProductionCandidate')) {
  fail('manifest export must not mutate review or release state');
}
if (manifestBlock.includes('updateDiscoverConfig') || manifestBlock.includes('saveDiscoverConfig')) {
  fail('manifest export must not update Discover config');
}

console.log(JSON.stringify({
  passed: true,
  gates: [
    'review_manifest_export_available',
    'manifest_is_review_only_and_nonproduction',
    'operator_can_handoff_to_discover_config_after_release',
    'handoff_does_not_mutate_review_release_or_discover_state',
  ],
}, null, 2));
