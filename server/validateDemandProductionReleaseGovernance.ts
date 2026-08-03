import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fail = (message: string): never => {
  throw new Error(`Demand production release governance validation failed: ${message}`);
};
const assertIncludes = (source: string, needle: string, label: string) => {
  if (!source.includes(needle)) fail(`missing ${label}`);
};

const server = read('server/index.ts');
const domain = read('src/lib/domain.ts');
const api = read('src/lib/api.ts');
const dashboard = read('src/pages/AdminDashboard.tsx');

assertIncludes(server, 'demandProductionReleaseBlockers', 'shared release blocker function');
assertIncludes(server, "batch.approvalState !== 'human_passed_release_candidate'", 'human pass required before release governance');
assertIncludes(server, "row.status !== 'private'", 'private candidate gate before publishing');
assertIncludes(server, "row.render_status !== 'ready'", 'ready render status gate');
assertIncludes(server, '!row.published_version_id', 'frozen published version gate');
assertIncludes(server, "recipe.versionState !== 'frozen'", 'Recipe V2 frozen gate');
assertIncludes(server, "row.machine_passed !== true", 'machine QA pass gate');
assertIncludes(server, 'releaseBlockersForStemRow(stem)', 'asset rights QA and Voice-free gate reuse');
assertIncludes(server, "app.post('/api/admin/demand-production-review/:mixId/release-governance'", 'release governance API');
assertIncludes(server, "status = 'published'", 'controlled publish into eligible pool');
assertIncludes(server, "approvalState: 'release_governance_passed'", 'release governance approval state');
assertIncludes(server, 'eligible_pool_only_not_auto_bound_to_discover_config', 'Discover non-auto-bind boundary');

const releaseRouteStart = server.indexOf("app.post('/api/admin/demand-production-review/:mixId/release-governance'");
const releaseRouteEnd = server.indexOf("app.get('/api/admin/assets'", releaseRouteStart);
if (releaseRouteStart < 0 || releaseRouteEnd < 0) fail('could not isolate release governance route');
const releaseRoute = server.slice(releaseRouteStart, releaseRouteEnd);
if (releaseRoute.includes('DISCOVER_CONFIG_PATH') || releaseRoute.includes('writeFile(')) {
  fail('release governance route must not write Discover config');
}

assertIncludes(domain, 'releaseEligible: boolean', 'frontend release eligibility contract');
assertIncludes(domain, 'releaseBlockers: string[]', 'frontend release blockers contract');
assertIncludes(domain, 'releaseGovernance: null', 'frontend release governance state contract');
assertIncludes(api, 'releaseAdminDemandProductionCandidate', 'frontend release client');
assertIncludes(dashboard, '通过发布治理', 'admin release governance button');
assertIncludes(dashboard, '发布阻断', 'admin release blockers copy');
assertIncludes(dashboard, '不会自动写入发现页配置', 'admin non-auto-Discover copy');
assertIncludes(dashboard, '已入发布可选池', 'admin released state copy');

console.log(JSON.stringify({
  passed: true,
  gates: [
    'human_pass_required_before_release',
    'machine_render_recipe_and_asset_release_gates_rechecked',
    'controlled_publish_creates_discover_eligible_pool_item',
    'release_governance_does_not_write_discover_config',
    'admin_ui_shows_release_eligibility_and_blockers',
  ],
}, null, 2));
