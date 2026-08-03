import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fail = (message: string): never => {
  throw new Error(`Demand production review validation failed: ${message}`);
};
const assertIncludes = (source: string, needle: string, label: string) => {
  if (!source.includes(needle)) fail(`missing ${label}`);
};

const server = read('server/index.ts');
const domain = read('src/lib/domain.ts');
const api = read('src/lib/api.ts');
const dashboard = read('src/pages/AdminDashboard.tsx');

assertIncludes(server, "app.get('/api/admin/demand-production-review'", 'admin demand production review list API');
assertIncludes(server, "app.patch('/api/admin/demand-production-review/:mixId'", 'admin demand production review decision API');
assertIncludes(server, "decision must be passed, needs_rework, or rejected", 'decision validation');
assertIncludes(server, "Only private, rendered, machine-ready candidates can pass human review", 'human pass eligibility gate');
assertIncludes(server, "human_passed_release_candidate", 'human passed approval state');
assertIncludes(server, "publicReleaseAllowed: false", 'human pass does not publish');
assertIncludes(server, "discoverPlacementAllowed: false", 'human pass does not place Discover');
assertIncludes(server, "release_governance_required", 'release governance boundary');
assertIncludes(domain, 'AdminDemandProductionReview', 'frontend review contract');
assertIncludes(api, 'getAdminDemandProductionReview', 'frontend review list client');
assertIncludes(api, 'reviewAdminDemandProductionCandidate', 'frontend review decision client');
assertIncludes(dashboard, 'DemandProductionReviewPanel', 'admin review panel');
assertIncludes(dashboard, '本批次人工听审', 'admin review UI title');
assertIncludes(dashboard, 'sectionFromHash', 'admin section hash resolver');
assertIncludes(dashboard, 'hashchange', 'admin section hash listener');
assertIncludes(dashboard, "selectAdminSection('assets')", 'admin hash-aware section navigation');
assertIncludes(dashboard, "window.history.replaceState(null, '', `${window.location.pathname}#${section}`)", 'admin section hash update');
assertIncludes(dashboard, '<audio controls', 'review audio playback control');
assertIncludes(dashboard, '人工听审备注', 'review notes field');
assertIncludes(dashboard, '人工只做最终决策', 'human decision-only guidance');
assertIncludes(dashboard, '需求队列', 'demand queue filter');
assertIncludes(dashboard, '听审状态', 'review status filter');
assertIncludes(dashboard, '全部待听审', 'review queue quick filter');
assertIncludes(dashboard, '待听', 'review queue counters');
assertIncludes(dashboard, '人工通过', 'human pass button');
assertIncludes(dashboard, '仍需发布治理', 'UI preserves release boundary');

if (dashboard.includes('fitScore') || dashboard.includes('differentiationScore') || dashboard.includes('paidValueScore')) {
  fail('admin human review UI must not require manual scoring');
}
if (server.includes('fitScore must be at least 4') || server.includes('paidValueScore must be at least 4')) {
  fail('server human review API must not require manual scoring');
}

console.log(JSON.stringify({
  passed: true,
  gates: [
    'review_lists_demand_batch_candidates',
    'review_requires_private_rendered_machine_ready_for_human_pass',
    'review_does_not_publish_or_discover_place',
    'admin_review_ui_supports_audio_playback_and_decisions',
  ],
}, null, 2));
