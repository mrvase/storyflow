const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./index.tsx",
    "../../cms/cms-panel/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      ...colors,
      gray: {
        ...colors.gray,
        ["700"]: "rgb(55, 65, 81)",
        ["725"]: "rgb(48, 58, 77)", // used for subtle gradient from 700 to 725
        ["750"]: "rgb(42, 53, 68)",
        ["825"]: "rgb(28, 39, 56)",
        ["835"]: "rgb(26, 36, 51)",
        ["850"]: "rgb(24, 33, 47)",
        ["900"]: "rgb(17, 23, 33)",
        ["925"]: "rgb(16, 22, 32)",
        ["950"]: "rgb(12, 17, 23)",
      },
    },
    extend: {
      animation: {
        load: "load 750ms ease-in-out infinite",
        blink: "blink 1000ms steps(1) infinite",
        "ping-lg": "ping-lg 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "ping-lg-delay": "ping-lg 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.1s",
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
        "ping-lg": {
          "0%": { transform: "scale(1)", opacity: 1 },
          "75%, 100%": { transform: "scale(5)", opacity: 0 },
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
