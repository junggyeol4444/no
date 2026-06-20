import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f6f7",
          100: "#e3e3e7",
          200: "#c7c7d1",
          300: "#a3a3b3",
          400: "#7c7c90",
          500: "#5f5f73",
          600: "#4b4b5c",
          700: "#3e3e4b",
          800: "#353540",
          900: "#2f2f38",
          950: "#1b1b21",
        },
      },
      fontFamily: {
        serif: ["Georgia", "'Nanum Myeongjo'", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
