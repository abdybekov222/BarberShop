/** Заголовки безопасности (ТЗ §2.5): HSTS, запрет фреймов, MIME-sniffing, доступ к камере только для себя. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

// Фото товаров, загруженные из админки, отдаёт наш API
const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allows a clean local cache when a synced .next directory contains placeholders.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@barbershop/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: api.protocol.replace(':', ''), hostname: api.hostname, port: api.port, pathname: '/api/files/public/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
