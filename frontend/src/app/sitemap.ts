import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://barbershop.kg';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    { path: '', priority: 1.0, changeFreq: 'weekly' as const },
    { path: 'services', priority: 0.9, changeFreq: 'monthly' as const },
    { path: 'shop', priority: 0.9, changeFreq: 'daily' as const },
    { path: 'about', priority: 0.6, changeFreq: 'monthly' as const },
    { path: 'gallery', priority: 0.8, changeFreq: 'weekly' as const },
    { path: 'team', priority: 0.7, changeFreq: 'monthly' as const },
    { path: 'booking', priority: 0.9, changeFreq: 'always' as const },
    { path: 'contacts', priority: 0.6, changeFreq: 'monthly' as const },
    { path: 'auth', priority: 0.4, changeFreq: 'never' as const },
    { path: 'privacy', priority: 0.3, changeFreq: 'yearly' as const },
    { path: 'terms', priority: 0.3, changeFreq: 'yearly' as const },
    { path: 'ai-consent', priority: 0.3, changeFreq: 'yearly' as const },
  ];

  return staticRoutes.map((r) => ({
    url: `${BASE_URL}/${r.path}`.replace(/\/$/, '') || BASE_URL,
    lastModified: now,
    changeFrequency: r.changeFreq,
    priority: r.priority,
  }));
}
