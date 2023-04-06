const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    colors: {
      ...colors,
      gray: {
        ...colors.gray,
        ["850"]: "rgb(24, 33, 47)",
        ["950"]: "rgb(8, 14, 26)",
      },
    },
    extend: {
      animation: {
        load: "load 750ms ease-in-out infinite",
        blink: "blink 1000ms steps(1) infinite",
      },
      keyframes: {
        load: {
          "0%": { transform: "translateX(-100%)" },
          "60%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        blink: {
          "0%": { opacity: 1 },
          "50%": { opacity: 0 },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/container-queries"),
    function ({ addVariant }) {
      addVariant("child", "& > *");
      addVariant("child-hover", "& > *:hover");
      addVariant("checked-label", "&:checked + label");
    },
  ],
  darkMode: "class",
};
