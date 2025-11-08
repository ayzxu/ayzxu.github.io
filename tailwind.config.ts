import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'beige-text': '#1f1b16',
        'beige-surface': '#fffaf3',
        'ai-surface': '#111418',
      },
      backgroundImage: {
        'beige-gradient': 'radial-gradient(1200px 800px at 20% -10%, #f7f1e8, #e9e2d6)',
        'ai-gradient': 'radial-gradient(1200px 800px at 20% -10%, #101214, #181a1f)',
      },
    },
  },
  plugins: [],
} satisfies Config;
