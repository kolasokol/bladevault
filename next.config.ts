import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  allowedDevOrigins: ['192.168.0.155'],
  output: 'standalone',
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      }
    }
    return config
  },
}

export default nextConfig
