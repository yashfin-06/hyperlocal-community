/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      colors: {
        sand: {
          50: '#fbf8f3',
          100: '#f5efe4',
          200: '#e9dcc4',
          300: '#d9c4a0',
          400: '#c7a877',
          500: '#b88f55',
          600: '#a37744',
          700: '#855f38',
          800: '#6b4d30',
          900: '#563f28',
        },
        forest: {
          50: '#f1f7f3',
          100: '#dcebe0',
          200: '#bad8c2',
          300: '#8cbd9b',
          400: '#5a9b73',
          500: '#3a7d56',
          600: '#2a6344',
          700: '#214f37',
          800: '#1b3f2c',
          900: '#163325',
        },
        clay: {
          50: '#fdf5f2',
          100: '#fae6df',
          200: '#f3c9bb',
          300: '#eaa58e',
          400: '#df7a5c',
          500: '#d05a38',
          600: '#b74525',
          700: '#973621',
          800: '#7c2e1e',
          900: '#65281d',
        },
        ink: {
          50: '#f6f6f4',
          100: '#e8e8e3',
          200: '#d2d2c9',
          300: '#b1b1a4',
          400: '#8a8a7a',
          500: '#6d6d5e',
          600: '#56564a',
          700: '#45453c',
          800: '#2f2f29',
          900: '#1c1c18',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28,28,24,0.04), 0 4px 16px rgba(28,28,24,0.06)',
        lift: '0 2px 4px rgba(28,28,24,0.06), 0 12px 32px rgba(28,28,24,0.10)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
