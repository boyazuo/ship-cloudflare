import { z } from 'zod';

const appConfigSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    url: z.url(),
  }),
  pricing: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        price: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .min(1),
});

export const appConfig = appConfigSchema.parse({
  app: {
    name: 'Ship SaaS',
    url: 'http://localhost:8787',
  },
  pricing: [
    {
      id: 'starter',
      name: 'Starter',
      price: '$0',
      description: 'The public pages and read-only API included in this template.',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$19 / month',
      description: 'A display price for the future billing plugin. Checkout is not connected.',
    },
  ],
});

export type AppConfig = z.infer<typeof appConfigSchema>;
