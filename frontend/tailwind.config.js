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
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
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
