const API_ORIGIN = 'https://api-production-c2b7.up.railway.app';

const shouldProxy = (pathname) => (
  pathname === '/api'
  || pathname.startsWith('/api/')
  || pathname.startsWith('/audio/')
  || pathname.startsWith('/exports/')
);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!shouldProxy(url.pathname)) return env.ASSETS.fetch(request);

    const upstreamUrl = new URL(`${url.pathname}${url.search}`, API_ORIGIN);
    return fetch(new Request(upstreamUrl, request));
  },
};
