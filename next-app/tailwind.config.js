const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          DEFAULT: "#FF6B35",
          50: "#FFF3ED",
          100: "#FFE4D4",
          200: "#FFC5A8",
          300: "#FFA071",
          400: "#FF6B35",
          500: "#F04E1A",
          600: "#D13910",
          700: "#AD2B10",
          800: "#8A2514",
          900: "#702214",
        },
        background: "#0E1117",
        surface: "#1A1D24",
        "surface-hover": "#262730",
        "surface-1": "#161B22",
        "surface-2": "#1C2128",
        "surface-3": "#22272E",
        border: "#2E3139",
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
        info: "#3B82F6",
      },
      boxShadow: {
        glow: "0 0 20px rgba(255, 107, 53, 0.15)",
      },
    },
  },
  plugins: [],
}
