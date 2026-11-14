import type { APIRoute } from 'astro';
import { appConfig } from '../../../app.config';

export const prerender = true;

export const GET: APIRoute = () => {
  const sitemap = new URL('/sitemap.xml', appConfig.app.url).href;
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
