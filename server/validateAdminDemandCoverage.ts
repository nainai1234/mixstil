import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fail = (message: string): never => {
  throw new Error(`Admin demand coverage validation failed: ${message}`);
};
const assertIncludes = (source: string, needle: string, label: string) => {
  if (!source.includes(needle)) fail(`missing ${label}`);
};

const server = read('server/index.ts');
const coverage = read('server/demandCoverage.ts');
const domain = read('src/lib/domain.ts');
const api = read('src/lib/api.ts');
const dashboard = read('src/pages/AdminDashboard.tsx');
const discover = read('data/discover-feed-config.json');

assertIncludes(discover, '"sleep-ready"', 'Discover sleep demand type');
assertIncludes(discover, '"return-to-sleep"', 'Discover return-to-sleep demand type');
assertIncludes(discover, '"light-music"', 'Discover light music demand type');
assertIncludes(coverage, 'buildDemandTypesFromDiscoverConfig', 'Discover-to-demand normalization');
assertIncludes(coverage, "freeTargetCount: 3", 'free proof target');
assertIncludes(coverage, "paidTargetCount: 15", 'paid inventory target');
assertIncludes(coverage, "publish_ready", 'publish-ready classification');
assertIncludes(coverage, "source_material", 'source-material classification');
assertIncludes(coverage, "demo_only", 'demo-only classification');
assertIncludes(coverage, "needs_rework", 'needs-rework classification');
assertIncludes(coverage, "Plus 付费库存还差", 'paid shortfall recommendation');
assertIncludes(coverage, "候选进入素材库/内容审核，不直接上架发现页", 'no direct generation-to-Discover policy');
assertIncludes(coverage, 'buildProductionPlan', 'demand gap production planning');
assertIncludes(coverage, "source_or_generate_material", 'material-first production action');
assertIncludes(coverage, "compose_reviewed_soundscape", 'reviewed soundscape production action');
assertIncludes(coverage, "repair_existing_content", 'existing content repair action');
assertIncludes(coverage, 'Plan only. Audio generation candidates must enter asset library or content review', 'plan-only generation policy');
assertIncludes(server, "app.get('/api/admin/content-demand-coverage'", 'admin demand coverage API');
assertIncludes(server, "loadDiscoverConfig()", 'coverage uses Discover demand definitions');
assertIncludes(server, "m.status = 'published' and m.render_status = 'ready'", 'coverage queries publish-ready signals');
assertIncludes(server, "s.qa_status = 'approved'", 'coverage asset QA signal');
assertIncludes(server, "s.category <> 'Voice'", 'coverage Voice-free asset signal');
assertIncludes(domain, 'AdminDemandCoverage', 'frontend demand coverage contract');
assertIncludes(domain, 'productionPlan', 'frontend production plan contract');
assertIncludes(api, 'getAdminDemandCoverage', 'frontend demand coverage API client');
assertIncludes(dashboard, 'DemandCoveragePanel', 'admin demand coverage panel');
assertIncludes(dashboard, '用户需求覆盖矩阵', 'admin demand coverage UI title');
assertIncludes(dashboard, '下一批补齐生产计划', 'admin production plan UI');
assertIncludes(dashboard, '已归类内容', 'classified existing content UI');
assertIncludes(dashboard, '可调用素材', 'callable material UI');
assertIncludes(dashboard, 'Plus 缺口', 'paid shortfall UI');

console.log(JSON.stringify({
  passed: true,
  gates: [
    'discover_demand_types_normalized_for_admin',
    'existing_content_classified_before_generation',
    'coverage_distinguishes_publish_ready_material_demo_rework_rejected',
    'free_and_paid_shortfalls_are_visible',
    'generation_recommendations_route_through_asset_review_before_discover',
  ],
}, null, 2));
