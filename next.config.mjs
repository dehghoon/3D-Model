/** @type {import("next").NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    //
    / @thatopen/fragments ships an ESM .worker.mjs asset.
    // Next.js 14.2 Terser treats that emitted .cjs asset as script code
    // during client production minification and fails on its ESM exports.
    // That Open Fragments is not used as the canonical model data layer here;
    // the worker is a transitive asset of the OBC core package. Preserve
    // ESM syntax by skipping Webpack minification for the browser build.
    if (!dev && !isServer) {
      config.optimization.minimize = false;
    }

    return config;
  },
};

export default nextConfig;
