/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8ecf3',
          100: '#c5d0e0',
          200: '#9fb0cb',
          300: '#7990b6',
          400: '#5e78a7',
          500: '#436098',
          600: '#3b5590',
          700: '#304785',
          800: '#26397a',
          900: '#132060',
          950: '#071428',
        },
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        sidebar: {
          DEFAULT: '#0f172a',
          hover:   '#1e293b',
          border:  '#1e293b',
          text:    '#94a3b8',
          active:  '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #071428 0%, #0d2144 100%)',
      },
    },
  },
  plugins: [],
};
