import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fail = (message: string): never => {
  throw new Error(`Admin content pipeline governance validation failed: ${message}`);
};
const assertIncludes = (source: string, needle: string, label: string) => {
  if (!source.includes(needle)) fail(`missing ${label}`);
};

const server = read('server/index.ts');
const dashboard = read('src/pages/AdminDashboard.tsx');
const domain = read('src/lib/domain.ts');
const api = read('src/lib/api.ts');

assertIncludes(server, 'MIX_DISCOVER_ELIGIBLE_WHERE', 'shared Discover eligibility SQL');
assertIncludes(server, "discover_stem.qa_status <> 'approved'", 'Discover asset QA gate');
assertIncludes(server, "discover_stem.file_sha256 = ''", 'Discover hash gate');
assertIncludes(server, 'discover_stem.commercial_use_allowed = false', 'Discover commercial rights gate');
assertIncludes(server, 'discover_stem.derivative_use_allowed = false', 'Discover derivative rights gate');
assertIncludes(server, "discover_stem.category = 'Voice'", 'Voice-free Beta Discover gate');
assertIncludes(server, 'buildDiscoverGovernance(config', 'Discover governance builder');
assertIncludes(server, 'res.status(422).json', 'Discover blocked binding rejection');
assertIncludes(server, 'blockedBindings', 'Discover blocked binding payload');
assertIncludes(server, "app.get('/api/admin/knowledge'", 'admin knowledge catalog API');
assertIncludes(server, "app.patch('/api/admin/knowledge/concepts/:id'", 'admin knowledge concept update API');
assertIncludes(server, 'join audio_stems s on s.id = sc.stem_id', 'knowledge linked assets query');
assertIncludes(server, 'releaseBlockersForStemRow(row)', 'knowledge asset release blockers');

assertIncludes(domain, 'contentPipeline', 'Admin overview contentPipeline contract');
assertIncludes(domain, 'AdminKnowledgeCatalog', 'admin knowledge catalog domain contract');
assertIncludes(api, 'governance: {', 'Discover config governance API contract');
assertIncludes(api, 'getAdminKnowledge', 'admin knowledge API client');
assertIncludes(api, 'updateAdminKnowledgeConcept', 'admin knowledge update client');
assertIncludes(dashboard, 'UnifiedContentPipelinePanel', 'unified content pipeline panel');
assertIncludes(dashboard, '素材库是唯一音频源', 'asset source-of-truth UI copy');
assertIncludes(dashboard, '发现页只引用合格成品', 'Discover release governance UI copy');
assertIncludes(dashboard, '发现页发布门槛', 'Discover gate UI copy');
assertIncludes(dashboard, '概念树与搜索', 'knowledge concept tree UI');
assertIncludes(dashboard, '关联素材', 'knowledge linked assets UI');
assertIncludes(dashboard, '素材文件、授权、QA 仍然只在素材库管理', 'knowledge boundary UI');

console.log(JSON.stringify({
  passed: true,
  gates: [
    'discover_uses_eligible_content_only',
    'discover_save_rejects_blocked_bindings',
    'admin_overview_exposes_content_pipeline',
    'admin_ui_links_assets_knowledge_review_discover',
    'knowledge_catalog_exposes_concept_asset_references',
    'knowledge_concept_editing_keeps_asset_upload_in_asset_library',
  ],
}, null, 2));
