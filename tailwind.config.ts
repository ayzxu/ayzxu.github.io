import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        'lemonmilk': ['LemonMilk', 'sans-serif'],
      },
      colors: {
        // Light mode palette
        "beige-text": "#1f1b16",
        "beige-surface": "#fffaf3",

        // Dark mode palette
        "ai-surface": "#111418",
      },
      backgroundImage: {
        "beige-gradient":
          "radial-gradient(1200px 800px at 20% -10%, #f7f1e8, #e9e2d6)",

        // Dark gradient background (OpenAI grey aesthetic)
        "ai-gradient":
          "radial-gradient(1200px 800px at 20% -10%, #101214, #181a1f)",
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        "soft": "0 8px 30px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;