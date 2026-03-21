// 静态资源 CDN 地址（图片、音频等）
export const CDN_BASE_URL = process.env.NEXT_PUBLIC_CDN_BASE_URL || ''

// 配置文件 OSS 直连地址（JSON 文件，不走 CDN，确保实时更新）
export const OSS_BASE_URL = process.env.NEXT_PUBLIC_OSS_BASE_URL || ''
