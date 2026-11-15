import type { APIRoute } from 'astro';
import { appConfig } from '../../../app.config';

export const prerender = true;

const paths = ['/', '/pricing', '/privacy', '/terms'] as const;

export const GET: APIRoute = () => {
  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, appConfig.app.url).href}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
