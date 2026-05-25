import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Press Start 2P for chrome/headings, VT323 for readable body copy
        'pixel': ['"Press Start 2P"', 'monospace'],
        'mac': ['"VT323"', 'monospace'],
      },
      colors: {
        // 1-bit Macintosh System display palette
        "mac-black": "#000000",
        "mac-white": "#ffffff",
        // Exterior chassis palette (original Macintosh 128K beige)
        "mac-beige": "#d6cfb8",
        "mac-beige-dark": "#a89f82",
        "mac-beige-light": "#e8e2cd",
      },
      borderRadius: {
        // The original Macintosh UI uses hard, square corners
        none: "0",
      },
    },
  },
  plugins: [],
};

export default config;
