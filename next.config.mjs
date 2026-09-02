const nextConfig = {
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) {
      config.optimization.minimize = false;
    }
    return config;
  },
};

export default nextConfig;
