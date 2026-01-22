/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig

if (process.env.NODE_ENV === 'development') {
  try {
    const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare')
    initOpenNextCloudflareForDev()
  } catch (err) {
    // Optional dev helper not installed; skip setup instead of throwing.
    // This enables `npm install` to succeed without the dev dependency.
    console.warn('@opennextjs/cloudflare not found; skipping dev bindings')
  }
}
