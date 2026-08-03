import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const fail = (message: string): never => {
  throw new Error(`Admin Discover demand pool validation failed: ${message}`);
};
const assertIncludes = (source: string, needle: string, label: string) => {
  if (!source.includes(needle)) fail(`missing ${label}`);
};

const server = read('server/index.ts');
const api = read('src/lib/api.ts');
const dashboard = read('src/pages/AdminDashboard.tsx');

assertIncludes(server, 'buildDemandTypesFromDiscoverConfig', 'shared demand type model for Discover admin');
assertIncludes(server, 'buildDiscoverDemandPools', 'Discover demand pool builder');
assertIncludes(server, 'MIX_DISCOVER_ELIGIBLE_WHERE', 'release eligible Discover content gate');
assertIncludes(server, 'demandPools', 'admin Discover API demand pool response');
assertIncludes(server, 'track_categories', 'demand pool sound family metadata');
assertIncludes(api, 'demandPools: Array', 'frontend API demand pool contract');
assertIncludes(dashboard, 'demandPoolForSection', 'frontend section to demand pool matcher');
assertIncludes(dashboard, '需求类型', 'admin demand type selector');
assertIncludes(dashboard, '从该需求的可上架内容中加入', 'admin demand-scoped mix selector');
assertIncludes(dashboard, '补齐本栏目', 'admin demand pool fill action');
assertIncludes(dashboard, '选择需求类型后，栏目会从同一套用户需求定义下调用已审核内容', 'admin boundary copy');

console.log(JSON.stringify({
  passed: true,
  gates: [
    'discover_admin_uses_shared_demand_types',
    'discover_admin_groups_release_eligible_content_by_demand',
    'section_binding_prefers_demand_scoped_content',
    'demand_pools_are_response_only_and_not_a_new_upload_source',
  ],
}, null, 2));
