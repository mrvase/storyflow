module.exports = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          has: [
            {
              type: "header",
              key: "x-dashboard",
            },
          ],
          destination: "/dashboard/index.html",
        },
      ],
    };
  },
  experimental: {
    appDir: true,
  },
  reactStrictMode: true,
  transpilePackages: [],
};
