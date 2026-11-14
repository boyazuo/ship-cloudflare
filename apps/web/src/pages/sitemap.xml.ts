import type { APIRoute } from 'astro';
import { publicPaths, site } from '../site';

export const prerender = true;

export const GET: APIRoute = () => {
  const urls = publicPaths
    .map((path) => `  <url><loc>${new URL(path, site.url).href}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
