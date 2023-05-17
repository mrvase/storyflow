module.exports = {
  async rewrites() {
    return [
      {
        source: "/verify",
        destination: "/api/auth/verify",
      },
      {
        source: "/((?!api).*)",
        destination: "/",
      },
      /*
      {
        source: "/((?!api).*)",
        destination: "/dashboard/index.html",
      },
      */
    ];
  },
  reactStrictMode: true,
  transpilePackages: [],
};
