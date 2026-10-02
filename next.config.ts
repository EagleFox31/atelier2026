import type { NextConfig } from 'next';

// BACKEND_URL : URL interne du serveur NestJS, lue au démarrage (pas au build).
// En dev     : http://localhost:3001 (défaut)
// En prod    : URL interne du conteneur/service NestJS (ex: http://api:3001)
const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy de l'application web, en mode REPORT-ONLY : le navigateur
// signale les violations dans la console sans rien bloquer. Étape suivante : passer
// en `Content-Security-Policy` (bloquant) après observation, idéalement avec des
// nonces pour retirer 'unsafe-inline' des scripts.
// Dérivée de ce que les pages chargent réellement :
// - scripts/styles : même origine ; Next injecte des scripts inline (hydratation)
//   et les composants posent des styles inline → 'unsafe-inline' ;
//   en dev seulement, React Refresh a besoin de 'unsafe-eval' et du websocket HMR ;
// - polices : next/font/google les auto-héberge (même origine) ;
// - images : fichiers locaux, /_next/image, logos en data: URL, aperçus blob: ;
// - connect : API /api/* et SSE /api/events via la même origine (Caddy en prod) ;
// - frame : aperçu PDF jsPDF en blob: dans les pages d'impression ;
// - worker : service worker /sw.js. Les liens WhatsApp / NotchPay sont des navigations.
const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: CONTENT_SECURITY_POLICY_REPORT_ONLY },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
};

export default nextConfig;
