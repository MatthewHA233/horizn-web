/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Puppeteer/Chromium 需要作为外部包，不被 webpack 打包
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'ali-oss'],
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_CDN_BASE_URL: process.env.NEXT_PUBLIC_CDN_BASE_URL || '',
  },
}

export default nextConfig
