const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

export {};

type Json = Record<string, any>;

type Dashboard = {
  mixes: Array<{ id: string; title: string; recipeData: { audioIntent?: { goal?: string } } }>;
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
};

let authToken = '';

const request = async <T extends Json>(pathname: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? 'unknown error'}`);
  return body as T;
};

const getDashboard = (search: URLSearchParams) => request<Dashboard>(`/api/studio?${search.toString()}`);

try {
  const guest = await request<Json>('/api/auth/guest', { method: 'POST' });
  authToken = String(guest.token ?? '');
  if (!authToken) throw new Error('My Sounds pagination validation could not create a guest session.');

  const source = await request<Json>('/api/public/mixes/mix_ocean_calm');
  for (let index = 1; index <= 7; index += 1) {
    const recipeData = structuredClone(source.mix.recipeData);
    recipeData.audioIntent = { ...(recipeData.audioIntent ?? {}), goal: index <= 4 ? 'sleep' : 'focus' };
    await request<Json>('/api/mixes', {
      method: 'POST',
      body: JSON.stringify({
        title: `Pagination Fixture ${index}`,
        description: `Owned My Sounds pagination fixture ${index}.`,
        status: 'draft',
        recipeData,
      }),
    });
  }

  const first = await getDashboard(new URLSearchParams({ page: '1', pageSize: '5' }));
  if (first.mixes.length !== 5 || first.pagination.page !== 1 || first.pagination.pageSize !== 5) {
    throw new Error('My Sounds did not honor the requested first page boundary.');
  }
  if (first.pagination.total !== 7 || !first.pagination.hasMore) {
    throw new Error('My Sounds did not report the owned second page.');
  }

  const second = await getDashboard(new URLSearchParams({ page: '2', pageSize: '5' }));
  const secondCount = second.mixes.length;
  if (secondCount !== 2 || second.pagination.hasMore) throw new Error('My Sounds returned an invalid second page boundary.');
  const firstIds = new Set(first.mixes.map((mix) => mix.id));
  if (second.mixes.some((mix) => firstIds.has(mix.id))) throw new Error('My Sounds pagination returned duplicate rows across pages.');

  const searched = await getDashboard(new URLSearchParams({ query: 'Fixture 7', pageSize: '5' }));
  if (searched.pagination.total !== 1 || searched.mixes[0]?.title !== 'Pagination Fixture 7') {
    throw new Error('My Sounds search did not return the matching title.');
  }
  const filtered = await getDashboard(new URLSearchParams({ goal: 'focus', pageSize: '5' }));
  if (filtered.pagination.total !== 3 || filtered.mixes.some((mix) => mix.recipeData.audioIntent?.goal !== 'focus')) {
    throw new Error('My Sounds goal filter returned a mismatched sound.');
  }

  console.log(JSON.stringify({
    passed: true,
    firstPageCount: first.mixes.length,
    secondPageCount: secondCount,
    total: first.pagination.total,
    pageSize: first.pagination.pageSize,
    authenticatedIsolation: true,
  }, null, 2));
} finally {
  if (authToken) {
    await fetch(`${API_BASE}/api/me`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${authToken}`, 'x-confirm-account-deletion': 'DELETE' },
    }).catch(() => undefined);
  }
}
