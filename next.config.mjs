/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // better-sqlite3 is a native module; keep it out of the bundler so it loads
    // via require() at runtime on the server.
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
