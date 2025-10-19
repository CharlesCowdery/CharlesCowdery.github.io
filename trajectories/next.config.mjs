
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',       // Enables static HTML export
  trailingSlash: true,    // Ensures S3-friendly folder structure
  images: {
    unoptimized: true,    // Disables next/image optimization (requires server)
  },
};



export default nextConfig;
