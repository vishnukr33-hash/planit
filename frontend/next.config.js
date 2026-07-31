/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://129.154.240.177:5000'}/api/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
