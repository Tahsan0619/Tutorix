import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
        bangla: ['"Hind Siliguri"', 'system-ui', 'sans-serif'],
        grotesk: ['"Bricolage Grotesque"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
        hand: ['Caveat', '"Hind Siliguri"', 'cursive'],
      },
      colors: {
        paper: '#F6F8FB',
        rule: '#CFDDF0',
        ink: '#1C2150',
        margin: '#D9453B',
        board: { DEFAULT: '#0B5D45', deep: '#083F30' },
        chalk: '#F4D35E',
        brand: {
          50: '#f3f1ff',
          100: '#e9e5ff',
          200: '#d5ceff',
          300: '#b6a7ff',
          400: '#9175fe',
          500: '#7446f9',
          600: '#6326ee',
          700: '#5318d1',
          800: '#4515aa',
          900: '#3a148a',
          950: '#220a5e',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.06)',
        glow: '0 10px 40px -10px rgba(99,38,238,.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .35s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [typography],
};
