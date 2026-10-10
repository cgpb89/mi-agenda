import path from 'node:path';
import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  sassOptions: {
    // Lets every *.module.scss do `@use 'tokens' as *;`
    loadPaths: [path.join(process.cwd(), 'src/styles')],
  },
  reactStrictMode: true,
  // Native module; keep it out of the server bundle.
  serverExternalPackages: ['@node-rs/argon2'],
  experimental: {
    serverActions: {
      // Request size cap for Server Actions (forms are small).
      bodySizeLimit: '256kb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
