/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        load: "load 750ms ease-in-out infinite",
      },
      keyframes: {
        load: {
          "0%": { transform: "translateX(-100%)" },
          "60%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
