import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async redirects() {
    return ['/admin', '/admin/:path+', '/malik', '/malik/login', '/malik/applications'].map(source => ({ source, destination: '/', permanent: false }));
  },
  async rewrites() {
    return [...['audio', 'uploads'].map(folder => ({ source: `/${folder}/:path*`, destination: `https://www.gkpgotlatent.in/${folder}/:path*` })), ...['logo.png', 'ggl-logo.png', 'favicon.ico'].map(file => ({ source: `/${file}`, destination: `https://www.gkpgotlatent.in/${file}` }))];
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};
export default nextConfig;
