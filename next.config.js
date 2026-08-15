/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Cache strategies
  runtimeCaching: [
    {
      // API routes — network first, fall back to cache
      urlPattern: /^\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "bakesync-api",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 },
        networkTimeoutSeconds: 5,
      },
    },
    {
      // Static assets — cache first
      urlPattern: /\.(?:png|jpg|jpeg|svg|ico|woff2?)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "bakesync-static",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // Next.js pages — stale-while-revalidate
      urlPattern: /^\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "bakesync-next-static",
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow all HTTPS remote images (e.g. user avatars from OAuth)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],

  },
};

module.exports = withPWA(nextConfig);
