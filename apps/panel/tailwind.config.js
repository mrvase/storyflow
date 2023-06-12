const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./index.tsx",
    "../../cms/admin-panel/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      ...colors,
      gray: {
        /*
        ...colors.gray,
        ["700"]: "rgb(55, 65, 81)",
        ["750"]: "rgb(42, 53, 68)",
        ["850"]: "rgb(24, 33, 47)",
        ["900"]: "rgb(17, 23, 33)",
        ["950"]: "rgb(12, 17, 23)",
        */

        50: "#f7f8fb",
        100: "#f2f4f7",
        150: "#ecedf1",
        200: "#dce0e7",
        250: "#cacdd8",
        300: "#c2c6d1",
        350: "#acb2bf",
        400: "#939ba7",
        450: "#80858f",
        500: "#6a7079",
        550: "#585d65",
        600: "#4e525b",
        650: "#43464e",
        700: "#373b43",
        750: "#2a2e36",
        800: "#1a2129",
        850: "#141b23",
        900: "#12161e",
        950: "#07080d",
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
