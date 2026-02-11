import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pump: {
          green: '#00ff88',
          dark: '#0a0a0a',
          gray: '#1a1a1a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
