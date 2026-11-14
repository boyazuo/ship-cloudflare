export async function serveAppShell(request: Request, assets: Fetcher): Promise<Response> {
  const existing = await assets.fetch(request);
  if (existing.status !== 404) return existing;
  await existing.body?.cancel();
  const indexUrl = new URL('/app/index.html', request.url);
  return assets.fetch(new Request(indexUrl, { method: 'GET' }));
}
