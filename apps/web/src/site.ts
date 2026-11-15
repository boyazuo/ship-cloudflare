export const site = {
  name: 'Ship Web',
  description: 'A static content site on Cloudflare, with one small browser tool.',
  url: 'http://127.0.0.1:4173',
} as const;

export const publicPaths = ['/', '/guide', '/tools/counter', '/privacy', '/terms'] as const;
