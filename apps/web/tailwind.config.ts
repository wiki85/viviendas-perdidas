import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1e2b27',
        paper: '#f7f3eb',
        coral: '#d9604c',
        moss: '#315d4c',
        sand: '#e9dfcf',
      },
      boxShadow: {
        panel: '0 18px 50px rgba(30, 43, 39, 0.16)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
