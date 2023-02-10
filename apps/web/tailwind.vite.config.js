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
        ...colors.gray,
        ["750"]: "rgb(40, 53, 73)",
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
    function ({ addVariant }) {
      addVariant("child", "& > *");
      addVariant("child-hover", "& > *:hover");
      addVariant("checked-label", "&:checked + label");
    },
  ],
  darkMode: "class",
};
